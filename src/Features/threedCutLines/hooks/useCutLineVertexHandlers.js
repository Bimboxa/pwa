import { useEffect, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";
import { Plane, Raycaster, Vector2, Vector3 } from "three";

import db from "App/db/db";
import theme from "Styles/theme";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import {
  setAnnotationToolbarPosition,
  setAnnotationsToolbarPosition,
} from "Features/mapEditor/mapEditorSlice";
import {
  selectSelectedItems,
  setSelectedPointIds,
  setSubSelection,
} from "Features/selection/selectionSlice";
import computeAxisLockSnap from "Features/threedAnnotationMove/utils/computeAxisLockSnap";
import intersectBaseMapPlane from "Features/threedBaseMapMove/utils/intersectBaseMapPlane";
import {
  clearPendingDimensionPatch,
  setPendingDimensionPatch,
} from "Features/threedDimensions/services/dimensionPendingPatchStore";
import getSingleSelectedAnnotationId from "Features/threedDimensions/utils/getSingleSelectedAnnotationId";
import { buildIndex } from "Features/threedDrawing/hooks/useVertexSnap";
import {
  buildAxisLockLine,
  removeAxisLockLine,
} from "Features/threedDrawing/utils/axisLockLine";
import {
  buildSegments,
  getCanvasResolution,
  getDashSize,
  makeLineMaterial,
} from "Features/threedDrawing/utils/drawingOverlayLines";
import intersectAnnotationFace from "Features/threedDrawing/utils/intersectAnnotationFace";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";
import { setMesh3dLabelGestureActive } from "Features/threedMesh/services/mesh3dLabelGestureStore";

import {
  CUT_LINE_DRAG_THRESHOLD_PX,
  CUT_LINE_VERTEX_PICK_PX,
} from "../constants/cutLineStyle";
import { getCutLineEntry } from "../services/cutLineObjectsStore";
import commitCutLineVertexMoveService, {
  computeCutLineVertexMovePatch,
} from "../services/commitCutLineVertexMoveService";

// Vertex snap distance (px) of a free drop, and the position tolerance
// (m) matching a marker's vertex in a Points buffer.
const DROP_VERTEX_SNAP_PX = 12;
const MARKER_MATCH_EPS = 1e-6;
const SEGMENT_AXIS_COLOR = theme.palette.secondary.fluo ?? "#ff4d00";

// The vertices of the SELECTED cut line (Features/threedCutLines) in 3D:
//   - hovering one shows the hand (grab), like the 2D vertices;
//   - a click (no move) sub-selects it (selection.selectedPointIds +
//     setSubSelection VERTEX) — ToolbarEditAnnotation then shows the point
//     row (ToolbarEditCutLinePoint: « Stop »);
//   - a drag moves it: free = vertex of the scene (12 px) → annotation
//     face → base map plane (user axes) → camera-facing plane through the
//     vertex; Shift = locked on the user axis (X / Y / Z of the gizmo frame)
//     or on the direction of a connected segment, whichever is closest to
//     the cursor on screen (computeAxisLockSnap), with a dashed guide line.
// The grab is a screen-distance test on the vertices published by the
// renderer (the markers never raycast). Mirror of useRulerLabelDragHandlers
// for the gesture plumbing: capture-phase pointerdown, orbit controls off,
// MainThreedEditor's pointerup stands down past the drag threshold, the
// dropped position is published to dimensionPendingPatchStore BEFORE the DB
// write (no snap-back frame). Commit: commitCutLineVertexMoveService (a new
// point row, the line re-encoded, one undo step).
export default function useCutLineVertexHandlers({ rendererIsReady }) {
  const store = useStore();
  const dispatch = useDispatch();
  const baseMaps = useBaseMaps()?.value;
  const baseMapsRef = useRef(baseMaps);
  baseMapsRef.current = baseMaps;

  // Modes that own the pointer — no vertex gesture while one is active.
  const meshingActive = useSelector((s) => s.threedEditor.meshingMode.active);
  const meshingTool = useSelector((s) => s.threedEditor.meshingMode.tool);
  const drawingActive = useSelector((s) => s.threedEditor.drawingMode.active);
  const walkActive = useSelector((s) => s.threedEditor.walkMode?.active);
  const extrudeActive = useSelector((s) => s.threedEditor.extrudeMode?.active);
  const moveAnnotationActive = useSelector(
    (s) => s.threedEditor.moveAnnotationMode?.active
  );
  const blockedRef = useRef(false);
  blockedRef.current = Boolean(
    drawingActive ||
    walkActive ||
    extrudeActive ||
    moveAnnotationActive ||
    (meshingActive && meshingTool !== "SELECT")
  );

  const yawDeg = useSelector((s) => s.threedEditor.axesSettings?.yawDeg ?? 0);
  const yawDegRef = useRef(yawDeg);
  yawDegRef.current = yawDeg;

  const dragRef = useRef(null);
  const hoverRef = useRef(false);

  useEffect(() => {
    if (!rendererIsReady) return;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    if (!dom || !sceneManager) return;

    const raycaster = new Raycaster();
    const ndc = new Vector2();

    function getCamera() {
      return sceneManager.camera;
    }

    function setRayFromClient(clientX, clientY) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, getCamera());
      return { width: rect.width, height: rect.height };
    }

    // The vertex of the selected cut line under the cursor (CSS px).
    function findVertexAtClient(clientX, clientY) {
      const selectedId = getSingleSelectedAnnotationId(
        selectSelectedItems(store.getState())
      );
      if (!selectedId) return null;
      const entry = getCutLineEntry(selectedId);
      if (!entry?.vertices?.length) return null;
      if (entry.group?.userData?.annotationType !== "CUT_LINE") return null;
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const camera = getCamera();
      const tmp = new Vector3();
      let best = null;
      let bestSq = CUT_LINE_VERTEX_PICK_PX * CUT_LINE_VERTEX_PICK_PX;
      for (const v of entry.vertices) {
        tmp.copy(v.world).project(camera);
        if (tmp.z < -1 || tmp.z > 1) continue;
        const sx = rect.left + ((tmp.x + 1) / 2) * rect.width;
        const sy = rect.top + ((1 - tmp.y) / 2) * rect.height;
        const d2 = (sx - clientX) ** 2 + (sy - clientY) ** 2;
        if (d2 < bestSq) {
          bestSq = d2;
          best = v;
        }
      }
      return best ? { entry, vertex: best } : null;
    }

    function buildLockLine(drag, axisKey) {
      const camera = getCamera();
      const axis = drag.axes.find((a) => a.key === axisKey);
      if (!axis) return null;
      if (axis.user) {
        return buildAxisLockLine({
          editor,
          camera,
          origin: drag.startWorld,
          dir: axis.dir,
          axis: axisKey,
        });
      }
      // Connected segment direction: the line's own colour.
      const distance = camera.position.distanceTo(drag.startWorld);
      const extent = Math.max(5, distance * 2);
      const mat = makeLineMaterial({
        color: SEGMENT_AXIS_COLOR,
        linewidth: 1.5,
        dashed: true,
        dashSize: getDashSize(distance),
        resolution: getCanvasResolution(editor),
      });
      const line = buildSegments(
        [
          {
            a: drag.startWorld.clone().addScaledVector(axis.dir, -extent),
            b: drag.startWorld.clone().addScaledVector(axis.dir, extent),
          },
        ],
        mat
      );
      if (line) line.renderOrder = 1003;
      return line;
    }

    function removeLockLine(drag) {
      if (!drag?.axisLine) return;
      removeAxisLockLine(drag.axisLine);
      drag.axisLine = null;
      drag.axis = null;
    }

    function updateLockLine(drag, axisKey) {
      if (!axisKey) {
        removeLockLine(drag);
        return;
      }
      if (drag.axis === axisKey && drag.axisLine) return;
      removeLockLine(drag);
      const line = buildLockLine(drag, axisKey);
      if (!line) return;
      sceneManager.scene.add(line);
      drag.axisLine = line;
      drag.axis = axisKey;
    }

    // Shift locks: the three user axes + the directions of the segments
    // connected to the vertex (towards each neighbour).
    function buildLockAxes(entry, vertex) {
      const axes = getUserAxesWorldDirections(yawDegRef.current).map((a) => ({
        key: a.key,
        dir: a.dir,
        user: true,
      }));
      const neighbours = [
        ["SEG_PREV", entry.vertices[vertex.index - 1]],
        ["SEG_NEXT", entry.vertices[vertex.index + 1]],
      ];
      for (const [key, nb] of neighbours) {
        if (!nb) continue;
        const dir = nb.world.clone().sub(vertex.world);
        if (dir.lengthSq() < 1e-10) continue;
        axes.push({ key, dir: dir.normalize(), user: false });
      }
      return axes;
    }

    // Free drop target of the cursor: scene vertex → annotation face → base
    // map plane → camera-facing plane through the grabbed vertex.
    function computeFreeHit(drag, canvasSize) {
      const camera = getCamera();
      if (!drag.index) {
        drag.index = buildIndex(sceneManager.scene, {
          excludeSubtree: drag.entry.group,
        }).verts;
      }
      const halfW = canvasSize.width / 2;
      const halfH = canvasSize.height / 2;
      const mx = ndc.x * halfW;
      const my = ndc.y * halfH;
      let best = null;
      let bestSq = DROP_VERTEX_SNAP_PX * DROP_VERTEX_SNAP_PX;
      const tmp = new Vector3();
      for (const v of drag.index) {
        tmp.copy(v.position).project(camera);
        if (tmp.z < -1 || tmp.z > 1) continue;
        const d2 = (tmp.x * halfW - mx) ** 2 + (tmp.y * halfH - my) ** 2;
        if (d2 < bestSq) {
          bestSq = d2;
          best = v.position;
        }
      }
      if (best) return new Vector3(best.x, best.y, best.z);

      const face = intersectAnnotationFace(editor, ndc, camera, {
        axes: drag.userAxes,
      });
      if (face?.position) return face.position.clone();
      const plan = intersectBaseMapPlane(editor, ndc, camera, {
        axes: drag.userAxes,
      });
      if (plan?.position) return plan.position.clone();
      const hit = new Vector3();
      return raycaster.ray.intersectPlane(drag.plane, hit) ? hit : null;
    }

    // Live update of the two segments and the marker holding the vertex.
    function applyPreview(drag, world) {
      const { entry, vertex } = drag;
      const local = entry.group.worldToLocal(world.clone());
      const segments = entry.group.userData.cutLineSegments || [];
      const prev = segments[vertex.index - 1]?.line;
      const next = segments[vertex.index]?.line;
      if (prev) {
        const pos = prev.geometry.attributes.instanceStart.data.array;
        prev.geometry.setPositions([
          pos[0],
          pos[1],
          pos[2],
          local.x,
          local.y,
          local.z,
        ]);
        prev.computeLineDistances();
      }
      if (next) {
        const pos = next.geometry.attributes.instanceStart.data.array;
        next.geometry.setPositions([
          local.x,
          local.y,
          local.z,
          pos[3],
          pos[4],
          pos[5],
        ]);
        next.computeLineDistances();
      }
      entry.group.children.forEach((child) => {
        if (!child.isPoints) return;
        const attr = child.geometry?.attributes?.position;
        if (!attr) return;
        for (let i = 0; i < attr.count; i++) {
          if (
            Math.abs(attr.getX(i) - drag.startLocal.x) < MARKER_MATCH_EPS &&
            Math.abs(attr.getY(i) - drag.startLocal.y) < MARKER_MATCH_EPS &&
            Math.abs(attr.getZ(i) - drag.startLocal.z) < MARKER_MATCH_EPS
          ) {
            attr.setXYZ(i, local.x, local.y, local.z);
            attr.needsUpdate = true;
          }
        }
      });
      drag.previewLocal = local;
      sceneManager.renderScene?.();
    }

    function endDrag() {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag) {
        const controls = sceneManager.controlsManager?.orbitControls;
        if (controls) controls.enabled = drag.prevControlsEnabled;
        removeLockLine(drag);
        dom.style.cursor = "";
        sceneManager.renderScene?.();
      }
      setMesh3dLabelGestureActive(false);
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerCancel);
      window.removeEventListener("keydown", onShiftChange);
      window.removeEventListener("keyup", onShiftChange);
      return drag;
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      if (blockedRef.current) return;
      const found = findVertexAtClient(e.clientX, e.clientY);
      if (!found) return;
      if (!setRayFromClient(e.clientX, e.clientY)) return;
      const { entry, vertex } = found;
      const camera = getCamera();

      entry.group.updateMatrixWorld(true);
      const startWorld = vertex.world.clone();
      const planeNormal = camera.getWorldDirection(new Vector3());
      const plane = new Plane().setFromNormalAndCoplanarPoint(
        planeNormal,
        startWorld
      );
      const controls = sceneManager.controlsManager?.orbitControls;
      const prevControlsEnabled = controls?.enabled ?? true;
      if (controls) controls.enabled = false;

      dragRef.current = {
        entry,
        vertex,
        startWorld,
        startLocal: entry.group.worldToLocal(startWorld.clone()),
        plane,
        axes: buildLockAxes(entry, vertex),
        userAxes: getUserAxesWorldDirections(yawDegRef.current),
        axis: null,
        axisLine: null,
        index: null,
        prevControlsEnabled,
        startClient: { x: e.clientX, y: e.clientY },
        lastClient: { clientX: e.clientX, clientY: e.clientY },
        moved: false,
        lastWorld: null,
      };
      dom.style.cursor = "grabbing";

      window.addEventListener("pointermove", onWindowPointerMove);
      window.addEventListener("pointerup", onWindowPointerUp);
      window.addEventListener("pointercancel", onWindowPointerCancel);
      window.addEventListener("keydown", onShiftChange);
      window.addEventListener("keyup", onShiftChange);

      // Keep camera-controls (registered on the same element) from starting
      // a camera drag with this gesture.
      e.stopImmediatePropagation();
      e.preventDefault();
    }

    function applyMove({ clientX, clientY, shiftKey }) {
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.moved) {
        const dx = Math.abs(clientX - drag.startClient.x);
        const dy = Math.abs(clientY - drag.startClient.y);
        if (
          dx <= CUT_LINE_DRAG_THRESHOLD_PX &&
          dy <= CUT_LINE_DRAG_THRESHOLD_PX
        )
          return;
        drag.moved = true;
        // From here on the vertex owns the gesture: the pointerup pick paths
        // stand down. A click without a move keeps them off too (we handle
        // the sub-selection ourselves below).
        setMesh3dLabelGestureActive(true);
      }
      const canvasSize = setRayFromClient(clientX, clientY);
      if (!canvasSize) return;

      let hit = null;
      let axis = null;
      if (shiftKey && drag.axes.length) {
        const lock = computeAxisLockSnap({
          mouseNdc: ndc,
          camera: getCamera(),
          canvasSize,
          origin: drag.startWorld,
          axes: drag.axes,
          raycaster,
        });
        if (lock) {
          hit = lock.position;
          axis = lock.axis;
        }
      }
      if (!hit) hit = computeFreeHit(drag, canvasSize);
      if (!hit) return;
      updateLockLine(drag, axis);
      drag.lastWorld = hit;
      applyPreview(drag, hit);
    }

    function onWindowPointerMove(e) {
      const drag = dragRef.current;
      if (!drag) return;
      drag.lastClient = { clientX: e.clientX, clientY: e.clientY };
      applyMove({
        clientX: e.clientX,
        clientY: e.clientY,
        shiftKey: e.shiftKey,
      });
    }

    function onShiftChange(e) {
      const drag = dragRef.current;
      if (e.key !== "Shift" || e.repeat || !drag?.moved) return;
      applyMove({ ...drag.lastClient, shiftKey: e.type === "keydown" });
    }

    async function onWindowPointerUp(e) {
      const drag = endDrag();
      if (!drag) return;
      const { entry, vertex } = drag;
      const annotationId = entry.annotationId;

      if (!drag.moved) {
        // A click: sub-select the vertex (the point row of the toolbar).
        dispatch(setSelectedPointIds([vertex.pointId]));
        dispatch(
          setSubSelection({ pointId: vertex.pointId, partType: "VERTEX" })
        );
        const position = { x: e.clientX, y: e.clientY };
        dispatch(setAnnotationToolbarPosition(position));
        dispatch(setAnnotationsToolbarPosition(position));
        // The pick paths of this pointerup must not deselect the line.
        setMesh3dLabelGestureActive(true);
        setTimeout(() => setMesh3dLabelGestureActive(false), 0);
        return;
      }
      if (!drag.lastWorld) return;

      try {
        const raw = await db.annotations.get(annotationId);
        const baseMap = (baseMapsRef.current || []).find(
          (b) => b.id === raw?.baseMapId
        );
        const result = computeCutLineVertexMovePatch({
          row: raw,
          // The resolved px points published by the renderer with the entry.
          resolvedPoints: entry.resolvedPoints ?? null,
          index: vertex.index,
          world: drag.lastWorld,
          baseMap,
        });
        if (!result) {
          console.warn(
            "[threedCutLines] vertex drop ignored: off the base map"
          );
          sceneManager.renderScene?.();
          return;
        }
        setPendingDimensionPatch(annotationId, {
          baseUpdatedAt: raw?.updatedAt ?? null,
          patch: result.patch,
        });
        dispatch(setSelectedPointIds([result.pointRow.id]));
        dispatch(
          setSubSelection({ pointId: result.pointRow.id, partType: "VERTEX" })
        );
        await commitCutLineVertexMoveService({
          annotationId,
          pointRow: result.pointRow,
          patch: result.patch,
        });
      } catch (err) {
        clearPendingDimensionPatch(annotationId);
        console.error("[threedCutLines] vertex move persist failed", err);
      }
    }

    function onWindowPointerCancel() {
      endDrag();
    }

    // Hand cursor over a vertex of the selected line (no gesture running).
    function onDomPointerMove(e) {
      if (dragRef.current) return;
      if (blockedRef.current) {
        if (hoverRef.current) {
          hoverRef.current = false;
          dom.style.cursor = "";
        }
        return;
      }
      const over = Boolean(findVertexAtClient(e.clientX, e.clientY));
      if (over === hoverRef.current) return;
      hoverRef.current = over;
      dom.style.cursor = over ? "grab" : "";
    }

    dom.addEventListener("pointerdown", onPointerDown, true);
    dom.addEventListener("pointermove", onDomPointerMove);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown, true);
      dom.removeEventListener("pointermove", onDomPointerMove);
      endDrag();
      if (hoverRef.current) {
        hoverRef.current = false;
        dom.style.cursor = "";
      }
    };
  }, [rendererIsReady, store, dispatch]);
}
