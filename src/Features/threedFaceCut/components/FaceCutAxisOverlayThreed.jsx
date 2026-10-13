import { useEffect, useRef, useSyncExternalStore } from "react";

import { useSelector, useStore } from "react-redux";
import { Group, Quaternion, Vector2, Vector3 } from "three";

import { Box } from "@mui/material";

import getEditableMesh3d, {
  mesh3dLocalToWorld,
  worldToMesh3dLocal,
} from "Features/annotationMesh3d/services/getEditableMesh3d";
import locateFaceNearHit from "Features/annotationMesh3d/utils/locateFaceNearHit";
import { getFaceLoops } from "Features/annotationMesh3d/utils/mesh3dTopology";
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
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { MESH3D_SNAP_PX } from "Features/threedMesh/utils/mesh3dConstants";
import {
  liftPointTo3d,
  projectPointTo2d,
} from "Features/threedMesh/utils/planeProjection";

import {
  clearFaceCutHoverCache,
  getCachedFaceCutContext,
  getCachedSurfaceCutContext,
  getFaceCutAxisHover,
  setFaceCutAxisHover,
  subscribeFaceCutAxisHover,
} from "../services/faceCutAxisStore";
import computeFaceAxisCut from "../utils/computeFaceAxisCut";
import computeSurfaceAxisCut, {
  getSurfaceBoundaryPoints,
} from "../utils/computeSurfaceAxisCut";
import { getFaceCutAxis } from "../utils/faceCutTools";
import getFaceCutBasisWorld from "../utils/getFaceCutBasisWorld";
import isSurfaceCutHost from "../utils/isSurfaceCutHost";
import resolveFaceCutLockedFace, {
  intersectLockedFace,
} from "../utils/resolveFaceCutLockedFace";

// Line colours: the plane blue of the drawing overlay, its lock red once the
// line snaps on a vertex / edge middle or sits on the typed distance, grey
// for a chord the cut refuses (an end on a hole).
const COLOR_LINE = 0x1565c0;
const COLOR_LOCK = 0xff1744;
const COLOR_REFUSED = 0x9e9e9e;
const COLOR_MARKER = 0xff2d8d;
const LINEWIDTH = 3;

// The chord is drawn this far (m) off the face, along its normal — on the
// face it would z-fight with it.
const DRAFT_LIFT_M = 2e-3;

// A face of the displayed object may sit up to 10 mm off the editable mesh
// (anti-aliasing shrink): locateFaceNearHit's slack.
const FACE_HIT_TOL_M = 0.02;

const notCuttableS = "Face non découpable";

function formatDistance(m) {
  return `${m.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m`;
}

// Hover of « Découpe horizontale / verticale » (Coupe face, 3D editor): the
// horizontal / vertical line through the cursor on the hovered face, snapped
// on the face's vertices (contour + holes) and edge middles, or locked on
// the typed distance from the face's bottom corner — drawn as a dashed line
// with markers on the reference corner and the guide point, and a distance
// chip between them. The result is published in faceCutAxisStore for the
// click / Enter (useDrawingPointerHandlers) and the bottom bar.
//
// The hovered face comes from the annotation's editable mesh
// (getEditableMesh3d, cached per annotation while the tool is armed: a db
// read + a conversion), located from the raycast hit (locateFaceNearHit);
// its frame is the viewer's (getFaceCutBasisWorld: u right, v up). Pointer
// moves are coalesced per animation frame, and a stale async result (another
// move landed meanwhile) is dropped.
//
// Tool launched on a SELECTED face (resolveFaceCutLockedFace): the hover is
// bound to that face — the cursor ray meets its plane (the plane's extension
// included: the chord is always inside the face), the face index is the
// selected one, nothing else is raycast.
//
// SURFACE host (isSurfaceCutHost: lathe, shell, swept profile): no planar
// face to chord — the hovered SOLID mesh (the whole surface, or one of the
// pieces of a previous cut) is cut by a plane (computeSurfaceAxisCut:
// horizontal, or the meridian / the line-of-sight vertical plane), its trace
// on the piece drawn as the dashed line, the reference / guide markers and
// the chip as on a face. The store then carries `surfaceCut` (plane + seed)
// for cutSurfaceAlongPlaneService.
export default function FaceCutAxisOverlayThreed() {
  const store = useStore();

  // data

  const axis = useSelector((s) =>
    s.threedEditor.drawingMode.active
      ? getFaceCutAxis(s.mapEditor.enabledDrawingMode)
      : null
  );
  // Cache invalidation: a cut (snap index epoch bump), the anti-aliasing
  // shrink toggle (the displayed objects change).
  const snapIndexEpoch = useSelector(
    (s) => s.threedEditor.drawingMode.snapIndexEpoch
  );
  const antiAliasingShrink = useSelector(
    (s) => s.threedEditor.antiAliasingShrink
  );
  // The line follows the typed distance and the side as they change.
  const faceCutSide = useSelector(
    (s) => s.threedEditor.drawingMode.faceCutSide
  );
  const constraintBuffer = useSelector((s) => s.mapEditor.constraintBuffer);
  const hover = useSyncExternalStore(
    subscribeFaceCutAxisHover,
    getFaceCutAxisHover
  );

  // state

  const lastNdcRef = useRef(null);
  const rerunRef = useRef(null);

  useEffect(() => {
    clearFaceCutHoverCache();
    rerunRef.current?.();
  }, [snapIndexEpoch, antiAliasingShrink]);

  useEffect(() => {
    rerunRef.current?.();
  }, [faceCutSide, constraintBuffer]);

  useEffect(() => {
    if (!axis) return undefined;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    const camera = sceneManager?.camera;
    const scene = sceneManager?.scene;
    if (!dom || !camera || !scene) return undefined;

    const root = new Group();
    root.name = "FaceCutAxisOverlayThreed";
    scene.add(root);
    // Precision cue: crosshair cursor while the cut axis is armed.
    dom.style.cursor = "crosshair";

    let disposed = false;
    let rafId = null;
    let requestId = 0;
    let draft = []; // objects of the current preview

    // helpers

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

    function showNothing() {
      clearDraft();
      setFaceCutAxisHover(null);
      render();
    }

    function toScreen(p, rect) {
      const v = new Vector3(p.x, p.y, p.z).project(camera);
      return {
        x: ((v.x + 1) / 2) * rect.width,
        y: ((1 - v.y) / 2) * rect.height,
      };
    }

    function lift(p2, basis) {
      const p = liftPointTo3d(p2, basis);
      const n = basis.n;
      return {
        x: p.x + n.x * DRAFT_LIFT_M,
        y: p.y + n.y * DRAFT_LIFT_M,
        z: p.z + n.z * DRAFT_LIFT_M,
      };
    }

    // MESH3D_SNAP_PX in face units (m): the screen length of 1 m along the
    // cut axis at the cursor.
    function getSnapToleranceM(cursor2d, basis, rect) {
      const coord = axis === "H" ? "y" : "x";
      const a = toScreen(liftPointTo3d(cursor2d, basis), rect);
      const b = toScreen(
        liftPointTo3d({ ...cursor2d, [coord]: cursor2d[coord] + 1 }, basis),
        rect
      );
      const pxPerMeter = Math.hypot(a.x - b.x, a.y - b.y);
      return pxPerMeter > 1e-6 ? MESH3D_SNAP_PX / pxPerMeter : 0;
    }

    function getViewRayWorld(hitPosition) {
      if (camera.isOrthographicCamera) {
        return camera.getWorldDirection(new Vector3());
      }
      return hitPosition
        .clone()
        .sub(camera.getWorldPosition(new Vector3()))
        .normalize();
    }

    // --- surface hosts ---------------------------------------------------

    // World triangle soup of a SOLID mesh (9 numbers per triangle).
    function bakeWorldSoup(mesh) {
      const geometry = mesh.geometry;
      const position = geometry?.getAttribute?.("position");
      if (!position) return null;
      const index = geometry.getIndex();
      const count = index ? index.count : position.count;
      const usable = count - (count % 3);
      const out = new Float64Array(3 * usable);
      const v = new Vector3();
      for (let i = 0; i < usable; i++) {
        v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(
          mesh.matrixWorld
        );
        out[3 * i] = v.x;
        out[3 * i + 1] = v.y;
        out[3 * i + 2] = v.z;
      }
      return out;
    }

    // Soup, boundary vertices and revolution axis (world) of a hovered
    // piece — cached per mesh while the tool is armed.
    function buildSurfaceCutContext(mesh) {
      mesh.updateWorldMatrix(true, false);
      const positions = bakeWorldSoup(mesh);
      if (!positions?.length) return null;
      const boundaryPoints = getSurfaceBoundaryPoints(positions);
      const axisData = mesh.userData?.revolutionAxis;
      let revolutionAxis = null;
      if (axisData?.center) {
        const point = mesh.localToWorld(
          new Vector3(
            axisData.center.x,
            axisData.center.y,
            axisData.center.z ?? 0
          )
        );
        const dir = (
          axisData.axisAlongNormal ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0)
        )
          .transformDirection(mesh.matrixWorld)
          .normalize();
        revolutionAxis = {
          point: { x: point.x, y: point.y, z: point.z },
          dir: { x: dir.x, y: dir.y, z: dir.z },
        };
      }
      return { positions, boundaryPoints, revolutionAxis };
    }

    // The trace is drawn a hair toward the camera so it never z-fights with
    // the surface it runs on.
    function liftToCamera(p) {
      const d = camera
        .getWorldPosition(new Vector3())
        .sub(new Vector3(p.x, p.y, p.z));
      const len = d.length();
      if (len === 0) return { ...p };
      d.multiplyScalar(DRAFT_LIFT_M / len);
      return { x: p.x + d.x, y: p.y + d.y, z: p.z + d.z };
    }

    // MESH3D_SNAP_PX along the plane normal, in meters at the hit.
    function getSurfaceSnapToleranceM(hitPosition, rect) {
      return (normal) => {
        const a = toScreen(hitPosition, rect);
        const b = toScreen(
          {
            x: hitPosition.x + normal.x,
            y: hitPosition.y + normal.y,
            z: hitPosition.z + normal.z,
          },
          rect
        );
        const pxPerMeter = Math.hypot(a.x - b.x, a.y - b.y);
        return pxPerMeter > 1e-6 ? MESH3D_SNAP_PX / pxPerMeter : 0;
      };
    }

    function runSurfaceHover(hit, rect) {
      const ctx = getCachedSurfaceCutContext(hit.object, () =>
        buildSurfaceCutContext(hit.object)
      );
      if (!ctx) {
        showNothing();
        return;
      }
      const s = store.getState();
      const viewDir = getViewRayWorld(hit.position);
      const result = computeSurfaceAxisCut({
        positions: ctx.positions,
        boundaryPoints: ctx.boundaryPoints,
        hitPoint: { x: hit.position.x, y: hit.position.y, z: hit.position.z },
        axis,
        side: s.threedEditor.drawingMode.faceCutSide,
        viewDir: { x: viewDir.x, y: viewDir.y, z: viewDir.z },
        revolutionAxis: ctx.revolutionAxis,
        typedDistance: parseRectBuffer(s.mapEditor.constraintBuffer),
        snapToleranceM: getSurfaceSnapToleranceM(hit.position, rect),
      });
      if (!result) {
        showNothing();
        return;
      }

      clearDraft();
      const color = result.snapped || result.locked ? COLOR_LOCK : COLOR_LINE;
      const line = buildSegments(
        result.segments.map(([p, q]) => ({
          a: liftToCamera(p),
          b: liftToCamera(q),
        })),
        makeLineMaterial({
          color,
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
      const refWorld = liftToCamera(result.ref);
      const guideWorld = liftToCamera(result.guide);
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
      setFaceCutAxisHover({
        nodeId: hit.nodeId,
        notCuttable: false,
        chordWorld: null,
        surfaceCut: {
          annotationId: hit.nodeId,
          axis,
          plane: result.plane,
          seed: { x: hit.position.x, y: hit.position.y, z: hit.position.z },
        },
        endsOnHole: false,
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

    async function runHover() {
      const mNdc = lastNdcRef.current;
      if (!mNdc) return;
      const myRequest = ++requestId;
      const rect = dom.getBoundingClientRect();

      const lock = resolveFaceCutLockedFace(store.getState(), editor);
      let hit;
      if (lock) {
        const locked = intersectLockedFace(lock, mNdc, camera, sceneManager);
        hit = locked
          ? {
              position: locked.position,
              normal: locked.normal,
              nodeId: lock.annotationId,
            }
          : null;
      } else {
        hit = intersectAnnotationFace(editor, mNdc, camera);
      }
      if (!hit?.nodeId) {
        showNothing();
        return;
      }
      // Surface host: the hit piece is cut by a plane (no planar face).
      if (!lock && hit.object) {
        const source = sceneManager.annotationsManager?.getAnnotationSource?.(
          hit.nodeId
        );
        if (isSurfaceCutHost(source)) {
          runSurfaceHover(hit, rect);
          return;
        }
      }
      const ctx = await getCachedFaceCutContext(hit.nodeId, () =>
        getEditableMesh3d({
          editor,
          annotationId: hit.nodeId,
          unshrink: false,
        })
      );
      if (disposed || myRequest !== requestId) return;
      if (!ctx) {
        clearDraft();
        const at = toScreen(hit.position, rect);
        setFaceCutAxisHover({
          nodeId: hit.nodeId,
          notCuttable: true,
          chordWorld: null,
          endsOnHole: false,
          distance: null,
          snapped: false,
          locked: false,
          chip: { x: at.x + 14, y: at.y + 14, text: notCuttableS },
        });
        render();
        return;
      }

      // The face under the hit, in the mesh's local frame (directions
      // rotate only — no translation, no z-fight shift).
      const qInv = ctx.baseMapGroup
        .getWorldQuaternion(new Quaternion())
        .invert();
      const localPoint = worldToMesh3dLocal(hit.position, ctx);
      const localNormal = hit.normal.clone().applyQuaternion(qInv);
      const localRay = getViewRayWorld(hit.position).applyQuaternion(qInv);
      // Locked face: its index holds on the displayed object's conversion
      // (unshrink: false reads that same object, and a mesh annotation's
      // stored mesh is the one getEditableMesh3d returns).
      const faceIndex = lock
        ? ctx.mesh.faces[lock.faceIndex]
          ? lock.faceIndex
          : -1
        : locateFaceNearHit(ctx.mesh, localPoint, localNormal, FACE_HIT_TOL_M, {
            rayDir: localRay,
          });
      if (faceIndex < 0) {
        showNothing();
        return;
      }

      const basis = getFaceCutBasisWorld(
        hit.normal,
        hit.position,
        ctx.baseMapGroup
      );
      const loops2d = getFaceLoops(ctx.mesh.faces[faceIndex]).map((loop) =>
        loop.map((vi) =>
          projectPointTo2d(
            mesh3dLocalToWorld(ctx.mesh.vertices[vi], ctx),
            basis
          )
        )
      );
      const cursor2d = projectPointTo2d(hit.position, basis);
      const s = store.getState();
      const result = computeFaceAxisCut({
        loops2d,
        cursor2d,
        axis,
        side: s.threedEditor.drawingMode.faceCutSide,
        typedDistance: parseRectBuffer(s.mapEditor.constraintBuffer),
        snapToleranceM: getSnapToleranceM(cursor2d, basis, rect),
      });
      if (!result) {
        showNothing();
        return;
      }

      clearDraft();
      const refWorld = lift(result.ref2d, basis);
      const guideWorld = lift(result.guide2d, basis);
      let chordWorld = null;
      if (result.chord2d) {
        const [a, b] = result.chord2d.map((p2) => lift(p2, basis));
        chordWorld = [a, b].map((p) => ({ ...p, nodeId: hit.nodeId }));
        const color = result.endsOnHole
          ? COLOR_REFUSED
          : result.snapped || result.locked
            ? COLOR_LOCK
            : COLOR_LINE;
        const line = buildSegments(
          [{ a, b }],
          makeLineMaterial({
            color,
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
      setFaceCutAxisHover({
        nodeId: hit.nodeId,
        notCuttable: false,
        chordWorld,
        endsOnHole: result.endsOnHole,
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
        runHover().catch((err) =>
          console.error("[threedFaceCut] axis hover failed", err)
        );
      });
    }
    rerunRef.current = () => {
      if (lastNdcRef.current) schedule();
    };

    // handlers

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
      requestId += 1;
      showNothing();
    }

    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onPointerLeave);
    // An annotation rebuilt while the tool is armed (a cut, a vertical edit):
    // its cached editable mesh is stale, and so is the hover on it.
    const unsubscribeReady =
      sceneManager.annotationsManager?.subscribeAnnotationReady?.(() => {
        clearFaceCutHoverCache();
        rerunRef.current?.();
      }) ?? null;
    return () => {
      disposed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rerunRef.current = null;
      lastNdcRef.current = null;
      unsubscribeReady?.();
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onPointerLeave);
      dom.style.cursor = "";
      clearDraft();
      scene.remove(root);
      setFaceCutAxisHover(null);
      clearFaceCutHoverCache();
      render();
    };
  }, [axis, store]);

  // render

  if (!axis || !hover?.chip) return null;
  const { chip, notCuttable } = hover;
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
          transform: notCuttable ? "none" : "translate(-50%, -50%)",
          bgcolor: notCuttable ? "background.paper" : "#f8c9c9",
          color: notCuttable ? "text.secondary" : "#b71c1c",
          border: notCuttable ? "1px solid" : "none",
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
