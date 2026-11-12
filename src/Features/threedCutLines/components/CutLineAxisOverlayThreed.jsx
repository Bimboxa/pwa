import { useEffect, useRef, useSyncExternalStore } from "react";

import { useSelector, useStore } from "react-redux";
import { Group, Vector2, Vector3 } from "three";

import { Box } from "@mui/material";

import parseRectBuffer from "Features/mapEditor/utils/parseRectBuffer";
import buildDrawingVertexMarkers from "Features/threedDrawing/utils/buildDrawingVertexMarkers";
import {
  buildSegments,
  disposeObject,
  getCanvasResolution,
  getDashSize,
  makeLineMaterial,
} from "Features/threedDrawing/utils/drawingOverlayLines";
import intersectAnnotationFace from "Features/threedDrawing/utils/intersectAnnotationFace";
import { selectIsCutLineDrawActive } from "Features/threedDrawing/utils/templateFaceDrawSelectors";
import { getFaceRegion } from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";
import buildMeshDataFromRegion from "Features/threedMesh/utils/buildMeshDataFromRegion";
import { MESH3D_SNAP_PX } from "Features/threedMesh/utils/mesh3dConstants";

import {
  getCutLineAxisHover,
  setCutLineAxisHover,
  subscribeCutLineAxisHover,
} from "../services/cutLineAxisStore";
import computeCutLineAxisChord from "../utils/computeCutLineAxisChord";

const COLOR_LINE = 0x1565c0;
const COLOR_LOCK = 0xff1744;
const COLOR_MARKER = 0xff2d8d;
const LINEWIDTH = 3;
const DRAFT_LIFT_M = 2e-3;

const unusableS = "Axe perpendiculaire à la face";
const curvedS = "Face non planaire";

function formatDistance(m) {
  return `${m.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m`;
}

// Hover of the X / Y / Z axis tools of the cut line (SectionCutLineDrawHelperContent,
// `threedEditor.cutLineDraw.axis`): the planar face region under the cursor
// (getFaceRegion + buildMeshDataFromRegion, the Maillage CREATE region) gets
// its chord parallel to the chosen user axis (computeCutLineAxisChord —
// the meshing « Découpe » logic rotated with the gizmo frame): dashed
// preview, reference / guide markers, distance chip. The result is published
// in cutLineAxisStore for the click / Enter of useDrawingPointerHandlers,
// which commits the chord as a drawn 2-point cut line (then extended along
// the faces like a free one). DrawingOverlayThreed is inert while an axis
// is armed.
export default function CutLineAxisOverlayThreed() {
  const store = useStore();

  // data

  const axis = useSelector((s) =>
    s.threedEditor.drawingMode.active && selectIsCutLineDrawActive(s)
      ? s.threedEditor.cutLineDraw.axis
      : null
  );
  const yawDeg = useSelector((s) => s.threedEditor.axesSettings.yawDeg);
  const side = useSelector((s) => s.threedEditor.cutLineDraw.side);
  const offset = useSelector((s) => s.threedEditor.cutLineDraw.offset);
  const constraintBuffer = useSelector((s) => s.mapEditor.constraintBuffer);
  const snapIndexEpoch = useSelector(
    (s) => s.threedEditor.drawingMode.snapIndexEpoch
  );
  const hover = useSyncExternalStore(
    subscribeCutLineAxisHover,
    getCutLineAxisHover
  );

  // state

  const lastNdcRef = useRef(null);
  const rerunRef = useRef(null);

  useEffect(() => {
    rerunRef.current?.();
  }, [yawDeg, side, offset, constraintBuffer, snapIndexEpoch]);

  useEffect(() => {
    if (!axis) return undefined;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    const camera = sceneManager?.camera;
    const scene = sceneManager?.scene;
    if (!dom || !camera || !scene) return undefined;

    const root = new Group();
    root.name = "CutLineAxisOverlayThreed";
    scene.add(root);
    dom.style.cursor = "crosshair";

    let rafId = null;
    let draft = [];
    // Face data of the hovered region, per mesh + region.
    let faceCache = { key: null, face: null };

    function clearDraft() {
      for (const obj of draft) {
        root.remove(obj);
        disposeObject(obj);
      }
      draft = [];
    }

    function render() {
      sceneManager.renderScene?.();
    }

    function showNothing(chip = null) {
      clearDraft();
      setCutLineAxisHover(
        chip ? { usable: false, chordWorld: null, chip } : null
      );
      render();
    }

    function toScreen(p, rect) {
      const v = new Vector3(p.x, p.y, p.z).project(camera);
      return {
        x: ((v.x + 1) / 2) * rect.width,
        y: ((1 - v.y) / 2) * rect.height,
      };
    }

    function lift(p, n) {
      return {
        x: p.x + n.x * DRAFT_LIFT_M,
        y: p.y + n.y * DRAFT_LIFT_M,
        z: p.z + n.z * DRAFT_LIFT_M,
      };
    }

    // MESH3D_SNAP_PX across the trace, in metres at the cursor.
    function getSnapToleranceM(cursor, v, rect) {
      const a = toScreen(cursor, rect);
      const b = toScreen(
        { x: cursor.x + v.x, y: cursor.y + v.y, z: cursor.z + v.z },
        rect
      );
      const pxPerMeter = Math.hypot(a.x - b.x, a.y - b.y);
      return pxPerMeter > 1e-6 ? MESH3D_SNAP_PX / pxPerMeter : 0;
    }

    function getHoveredFace(hit) {
      const object = hit.object;
      const angleDeg = store.getState().threedEditor.faceSelectionAngleDeg;
      const region = getFaceRegion(object.geometry, hit.faceIndex, {
        plane: !!object.userData?.hasSubtraction,
        angleDeg,
      });
      if (!region) return null;
      const key = `${object.uuid}:${angleDeg}:${region.regionId}`;
      if (faceCache.key !== key) {
        const data = buildMeshDataFromRegion(object, region.tris);
        faceCache = {
          key,
          face: data?.faces?.length === 1 ? data.faces[0] : null,
          curved: Boolean(data?.shell),
        };
      }
      return faceCache;
    }

    function runHover() {
      const ndc = lastNdcRef.current;
      if (!ndc) return;
      const rect = dom.getBoundingClientRect();
      const hit = intersectAnnotationFace(editor, ndc, camera);
      if (!hit?.object) {
        showNothing();
        return;
      }
      const { face, curved } = getHoveredFace(hit) || {};
      if (!face) {
        const at = toScreen(hit.position, rect);
        showNothing(
          curved ? { x: at.x + 12, y: at.y + 12, text: curvedS } : null
        );
        return;
      }
      const s = store.getState();
      const axisDir = getUserAxesWorldDirections(
        s.threedEditor.axesSettings.yawDeg
      ).find((a) => a.key === axis)?.dir;
      if (!axisDir) {
        showNothing();
        return;
      }
      const cursor = {
        x: hit.position.x,
        y: hit.position.y,
        z: hit.position.z,
      };
      // The snap tolerance needs the across direction: a first pass gives
      // the basis, the tolerance is then measured along its v.
      const probe = computeCutLineAxisChord({
        face,
        axisDir: { x: axisDir.x, y: axisDir.y, z: axisDir.z },
        cursor,
      });
      if (!probe.usable) {
        const at = toScreen(hit.position, rect);
        showNothing({ x: at.x + 12, y: at.y + 12, text: unusableS });
        return;
      }
      const result = computeCutLineAxisChord({
        face,
        axisDir: { x: axisDir.x, y: axisDir.y, z: axisDir.z },
        cursor,
        side: s.threedEditor.cutLineDraw.side,
        typedDistance: parseRectBuffer(s.mapEditor.constraintBuffer),
        offset: s.threedEditor.cutLineDraw.offset,
        snapToleranceM: getSnapToleranceM(cursor, probe.basis.v, rect),
      });
      if (!result.usable) {
        showNothing();
        return;
      }

      clearDraft();
      const n = result.basis.n;
      const faceNormal = { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z };
      let chordWorld = null;
      if (result.chord) {
        // The committed chord lies ON the face; only the draft is lifted.
        chordWorld = result.chord.map((p) => ({
          x: p.x,
          y: p.y,
          z: p.z,
          nodeId: hit.nodeId,
          faceNormal,
        }));
        const [a, b] = result.chord.map((p) => lift(p, n));
        const line = buildSegments(
          [{ a, b }],
          makeLineMaterial({
            color: result.snapped || result.locked ? COLOR_LOCK : COLOR_LINE,
            linewidth: LINEWIDTH,
            dashed: true,
            dashSize: getDashSize(camera.position.distanceTo(hit.position)),
            resolution: getCanvasResolution(editor),
          })
        );
        if (line) {
          line.renderOrder = 1002;
          root.add(line);
          draft.push(line);
        }
      }
      const refWorld = lift(result.ref, n);
      const guideWorld = lift(result.guide, n);
      const markers = buildDrawingVertexMarkers(
        [refWorld, guideWorld],
        COLOR_MARKER
      );
      if (markers) {
        markers.renderOrder = 1003;
        root.add(markers);
        draft.push(markers);
      }
      const mid = toScreen(
        {
          x: (refWorld.x + guideWorld.x) / 2,
          y: (refWorld.y + guideWorld.y) / 2,
          z: (refWorld.z + guideWorld.z) / 2,
        },
        rect
      );
      setCutLineAxisHover({
        nodeId: hit.nodeId,
        usable: true,
        chordWorld,
        distance: result.distance,
        snapped: result.snapped,
        locked: result.locked,
        chip: {
          x: mid.x,
          y: mid.y + 18,
          text: formatDistance(result.distance),
        },
      });
      render();
    }

    function schedule() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        try {
          runHover();
        } catch (err) {
          console.error("[threedCutLines] axis hover failed", err);
        }
      });
    }
    rerunRef.current = () => {
      if (lastNdcRef.current) schedule();
    };

    function onPointerMove(e) {
      const rect = dom.getBoundingClientRect();
      lastNdcRef.current = new Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      schedule();
    }

    function onPointerLeave() {
      lastNdcRef.current = null;
      showNothing();
    }

    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onPointerLeave);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rerunRef.current = null;
      lastNdcRef.current = null;
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onPointerLeave);
      dom.style.cursor = "";
      clearDraft();
      scene.remove(root);
      setCutLineAxisHover(null);
      render();
    };
  }, [axis, store]);

  // render

  if (!axis || !hover?.chip) return null;
  const { chip, usable } = hover;
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 5,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          left: chip.x,
          top: chip.y,
          transform: usable ? "translate(-50%, -50%)" : "none",
          bgcolor: usable ? "#f8c9c9" : "background.paper",
          color: usable ? "#b71c1c" : "text.secondary",
          border: usable ? "none" : "1px solid",
          borderColor: "divider",
          borderRadius: "8px",
          px: 1,
          py: 0.25,
          fontSize: 12,
          fontWeight: "bold",
          whiteSpace: "nowrap",
        }}
      >
        {chip.text}
      </Box>
    </Box>
  );
}
