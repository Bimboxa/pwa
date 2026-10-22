import { useEffect, useRef } from "react";

import { useSelector, useStore } from "react-redux";
import { Matrix4, Plane, Raycaster, Vector2, Vector3 } from "three";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import { selectSelectedItems } from "Features/selection/selectionSlice";
import computeAxisLockSnap from "Features/threedAnnotationMove/utils/computeAxisLockSnap";
import {
  buildAxisLockLine,
  removeAxisLockLine,
} from "Features/threedDrawing/utils/axisLockLine";
import {
  filterIntersectionsByClipping,
  getActiveClippingPlane,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";
// Reused as-is (see useAnnotationLabelDragHandlers): MainThreedEditor's
// pointerup stands down while the flag is on — the sprite is invisible to
// its `.isMesh` pick, which would otherwise act on the geometry behind it.
import { setMesh3dLabelGestureActive } from "Features/threedMesh/services/mesh3dLabelGestureStore";

import { getDimensionObjects } from "../services/dimensionObjectsStore";
import getSingleSelectedAnnotationId from "../utils/getSingleSelectedAnnotationId";

// Pointer movement (in CSS px) below which the gesture is treated as a plain
// click (selection) rather than an offset drag.
const DRAG_THRESHOLD_PX = 4;

// A user axis this parallel to the base map normal (|dot|) is off the plane
// of a plane-parallel cote: no lock on it (it would only bring the dimension
// line back onto the measured segment).
const OFF_PLANE_AXIS_DOT = 0.1;

const round2 = (v) => Math.round(v * 100) / 100;
const round4 = (v) => Math.round(v * 10000) / 10000;

// Dragging the value card of the SELECTED cote in 3D adjusts the
// dimension-line offset (an unselected cote only gets selected by the click,
// through MainThreedEditor's sprite pre-pass — same rule as the label cards):
//   - plane-parallel cote → writes `extensionOffset` (shared with the 2D
//     label drag of NodeCoteStatic, so both views stay in sync);
//   - vertical/oblique cote → writes the `offset3d` vector (basemap-local
//     meters), the only way to give such a cote an offset (its 2D projection
//     is degenerate).
// The drag is live: the cursor is projected on a camera-facing plane through
// the label, the displacement since the grab point is added to the current
// offset (the line keeps its grab offset, no jump) and constrained
// perpendicular to the measured segment; with Shift held the cursor is
// locked on the user axis of the gizmo frame (through the grab point)
// closest to it on screen — « Déplacer » parity, the axis drawn dashed in
// its colour. The Line2/extensions/sprite are updated imperatively; the
// annotation is persisted on pointerup (the DB write then re-triggers the
// rebuild).
export default function useCoteLabelDragHandlers({ rendererIsReady }) {
  const updateAnnotation = useUpdateAnnotation();
  const store = useStore();

  // Modes that own the pointer — no label drag while one is active (same
  // list as useAnnotationLabelDragHandlers: the Maillage module keeps
  // meshing on, so only a tool other than SELECT blocks).
  const meshingActive = useSelector((s) => s.threedEditor.meshingMode.active);
  const meshingTool = useSelector((s) => s.threedEditor.meshingMode.tool);
  const drawingActive = useSelector((s) => s.threedEditor.drawingMode.active);
  const walkActive = useSelector((s) => s.threedEditor.walkMode?.active);
  const extrudeActive = useSelector((s) => s.threedEditor.extrudeMode?.active);
  const blockedRef = useRef(false);
  blockedRef.current = Boolean(
    drawingActive ||
    walkActive ||
    extrudeActive ||
    (meshingActive && meshingTool !== "SELECT")
  );

  // Yaw of the displayed axes frame: the Shift locks follow the gizmo axes
  // (same as the 3D drawing and « Déplacer »). Read in the handlers through
  // a ref.
  const yawDeg = useSelector((s) => s.threedEditor.axesSettings?.yawDeg ?? 0);
  const yawDegRef = useRef(yawDeg);
  yawDegRef.current = yawDeg;

  const updateAnnotationRef = useRef(updateAnnotation);
  useEffect(() => {
    updateAnnotationRef.current = updateAnnotation;
  }, [updateAnnotation]);

  const dragRef = useRef(null);

  useEffect(() => {
    if (!rendererIsReady) return;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    const camera = sceneManager?.camera;
    if (!dom || !camera) return;

    const raycaster = new Raycaster();
    const ndc = new Vector2();

    function setRayFromClient(clientX, clientY) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      return { width: rect.width, height: rect.height };
    }

    function removeAxisLine(drag) {
      if (!drag?.axisLine) return;
      removeAxisLockLine(drag.axisLine);
      drag.axisLine = null;
      drag.axis = null;
    }

    // Dashed line along the locked axis through the grab point, in the axis
    // colour. Static for a given axis.
    function updateAxisLine(drag, axis) {
      if (!axis) {
        removeAxisLine(drag);
        return;
      }
      if (drag.axis === axis && drag.axisLine) return;
      removeAxisLine(drag);
      const dir = drag.axes.find((a) => a.key === axis)?.dir;
      if (!dir) return;
      const line = buildAxisLockLine({
        editor,
        camera,
        origin: drag.startHit,
        dir,
        axis,
      });
      if (!line) return;
      sceneManager.scene.add(line);
      drag.axisLine = line;
      drag.axis = axis;
    }

    function endDrag() {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag) {
        const controls = sceneManager.controlsManager?.orbitControls;
        if (controls) controls.enabled = drag.prevControlsEnabled;
        removeAxisLine(drag);
        sceneManager.renderScene?.();
      }
      // Released after the canvas-level pointerup listeners have run.
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
      const sprites = getDimensionObjects("COTE");
      if (!sprites.length) return;
      if (!setRayFromClient(e.clientX, e.clientY)) return;

      // A card hidden by the clipping plane is not grabbed (same filter as
      // the selection pre-pass of MainThreedEditor).
      const hits = filterIntersectionsByClipping(
        raycaster.intersectObjects(sprites, false),
        getActiveClippingPlane(sceneManager)
      );
      const sprite = hits[0]?.object;
      const annotationId = sprite?.userData?.annotationId;
      if (!annotationId) return;

      // Unselected cote: the click only selects it (MainThreedEditor's
      // handleClick, sprite pre-pass) — no drag, camera controls stay free.
      const selectedId = getSingleSelectedAnnotationId(
        selectSelectedItems(store.getState())
      );
      if (selectedId !== annotationId) return;

      const group = sprite.parent;
      const coteGeom = group?.userData?.coteGeom;
      const coteObjects = group?.userData?.coteObjects;
      if (!coteGeom || !coteObjects) return;

      group.updateMatrixWorld(true);
      const P1w = new Vector3(
        coteGeom.P1.x,
        coteGeom.P1.y,
        coteGeom.P1.z
      ).applyMatrix4(group.matrixWorld);
      const P2w = new Vector3(
        coteGeom.P2.x,
        coteGeom.P2.y,
        coteGeom.P2.z
      ).applyMatrix4(group.matrixWorld);
      const uWorld = P2w.clone().sub(P1w).normalize();
      const midWorld = P1w.clone().add(P2w).multiplyScalar(0.5);

      // Drag plane: through the current label position, facing the camera.
      // The label sits at the dimension line's midpoint: its offset from the
      // measured segment is the current offset vector.
      const labelWorld = sprite.getWorldPosition(new Vector3());
      const planeNormal = camera.getWorldDirection(new Vector3());
      const plane = new Plane().setFromNormalAndCoplanarPoint(
        planeNormal,
        labelWorld
      );
      const startHit = new Vector3();
      if (!raycaster.ray.intersectPlane(plane, startHit)) return;
      const offsetWorld = labelWorld.clone().sub(midWorld);

      // Shift locks: the user axes of the gizmo frame. A plane-parallel cote
      // keeps its line in its plan: the axes lying in that plane only.
      const baseMapNormal = new Vector3(0, 0, 1).transformDirection(
        group.matrixWorld
      );
      const userAxes = getUserAxesWorldDirections(yawDegRef.current);
      const axes = coteGeom.isPlaneParallel
        ? userAxes.filter(
            (a) => Math.abs(a.dir.dot(baseMapNormal)) < OFF_PLANE_AXIS_DOT
          )
        : userAxes;

      const controls = sceneManager.controlsManager?.orbitControls;
      const prevControlsEnabled = controls?.enabled ?? true;
      if (controls) controls.enabled = false;

      dragRef.current = {
        annotationId,
        group,
        coteGeom,
        coteObjects,
        uWorld,
        offsetWorld,
        plane,
        startHit,
        axes,
        axis: null,
        axisLine: null,
        prevControlsEnabled,
        startClient: { x: e.clientX, y: e.clientY },
        lastClient: { clientX: e.clientX, clientY: e.clientY },
        lastShiftKey: e.shiftKey,
        moved: false,
        // Live values persisted on pointerup.
        sMeters: null,
        vLocal: null,
      };

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
        if (dx <= DRAG_THRESHOLD_PX && dy <= DRAG_THRESHOLD_PX) return;
        drag.moved = true;
        // From here on the card owns the gesture: the pointerup pick path
        // of MainThreedEditor (selection toggle on Shift) stands down. A
        // click without a move keeps it — Shift+click still deselects.
        setMesh3dLabelGestureActive(true);
      }
      const canvasSize = setRayFromClient(clientX, clientY);
      if (!canvasSize) return;

      // Shift: the destination is locked on the user axis through the grab
      // point closest to the cursor on screen (no threshold, « Déplacer »
      // parity); else the cursor on the camera-facing plane.
      let hit = null;
      let axis = null;
      if (shiftKey && drag.axes.length) {
        const lock = computeAxisLockSnap({
          mouseNdc: ndc,
          camera,
          canvasSize,
          origin: drag.startHit,
          axes: drag.axes,
          raycaster,
        });
        if (lock) {
          hit = lock.position;
          axis = lock.axis;
        }
      }
      if (!hit) {
        hit = new Vector3();
        if (!raycaster.ray.intersectPlane(drag.plane, hit)) return;
      }
      updateAxisLine(drag, axis);

      // Current offset + displacement since the grab point, perpendicular
      // component vs the segment.
      const w = drag.offsetWorld.clone().add(hit.clone().sub(drag.startHit));
      const along = w.dot(drag.uWorld);
      const vWorld = w.addScaledVector(drag.uWorld, -along);

      // World → basemap-local direction (groups are unscaled, so the length
      // is preserved through the rotation).
      const len = vWorld.length();
      const inv = new Matrix4().copy(drag.group.matrixWorld).invert();
      const vLocal = vWorld.transformDirection(inv).multiplyScalar(len);

      const geom = drag.coteGeom;
      let V;
      if (geom.isPlaneParallel && geom.nLocal) {
        // Reduce to the signed in-plane offset shared with the 2D model.
        const s =
          vLocal.x * geom.nLocal.x +
          vLocal.y * geom.nLocal.y +
          vLocal.z * geom.nLocal.z;
        drag.sMeters = s;
        V = {
          x: geom.nLocal.x * s,
          y: geom.nLocal.y * s,
          z: geom.nLocal.z * s,
        };
      } else {
        drag.vLocal = { x: vLocal.x, y: vLocal.y, z: vLocal.z };
        V = drag.vLocal;
      }

      // Live update: dimension line, extensions, sprite.
      const D1 = {
        x: geom.P1.x + V.x,
        y: geom.P1.y + V.y,
        z: geom.P1.z + V.z,
      };
      const D2 = {
        x: geom.P2.x + V.x,
        y: geom.P2.y + V.y,
        z: geom.P2.z + V.z,
      };
      const { line, extensions, sprite } = drag.coteObjects;
      line.geometry.setPositions([D1.x, D1.y, D1.z, D2.x, D2.y, D2.z]);
      line.computeLineDistances();
      if (extensions?.length === 2) {
        extensions[0].geometry.setPositions([
          geom.P1.x,
          geom.P1.y,
          geom.P1.z,
          D1.x,
          D1.y,
          D1.z,
        ]);
        extensions[0].computeLineDistances();
        extensions[1].geometry.setPositions([
          geom.P2.x,
          geom.P2.y,
          geom.P2.z,
          D2.x,
          D2.y,
          D2.z,
        ]);
        extensions[1].computeLineDistances();
      }
      sprite.position.set(
        (D1.x + D2.x) / 2,
        (D1.y + D2.y) / 2,
        (D1.z + D2.z) / 2
      );
      sceneManager.renderScene?.();
    }

    function onWindowPointerMove(e) {
      const drag = dragRef.current;
      if (!drag) return;
      drag.lastClient = { clientX: e.clientX, clientY: e.clientY };
      drag.lastShiftKey = e.shiftKey;
      applyMove({
        clientX: e.clientX,
        clientY: e.clientY,
        shiftKey: e.shiftKey,
      });
    }

    // Shift pressed / released with a still mouse: lock / unlock at once.
    function onShiftChange(e) {
      const drag = dragRef.current;
      if (e.key !== "Shift" || e.repeat || !drag?.moved) return;
      drag.lastShiftKey = e.type === "keydown";
      applyMove({ ...drag.lastClient, shiftKey: drag.lastShiftKey });
    }

    async function onWindowPointerUp() {
      const drag = endDrag();
      if (!drag || !drag.moved) return;
      const geom = drag.coteGeom;
      try {
        if (geom.isPlaneParallel && drag.sMeters !== null) {
          const unit = geom.extensionOffsetUnit;
          const nextOffset =
            unit === "CM"
              ? round2(drag.sMeters * 100)
              : round2(drag.sMeters / geom.meterByPx);
          await updateAnnotationRef.current({
            id: drag.annotationId,
            extensionOffset: nextOffset,
          });
        } else if (!geom.isPlaneParallel && drag.vLocal) {
          await updateAnnotationRef.current({
            id: drag.annotationId,
            offset3d: {
              x: round4(drag.vLocal.x),
              y: round4(drag.vLocal.y),
              z: round4(drag.vLocal.z),
            },
          });
        }
      } catch (err) {
        console.error("[threedDimensions] cote offset persist failed", err);
      }
    }

    function onWindowPointerCancel() {
      endDrag();
    }

    // Capture phase so a sprite hit can stop the gesture before
    // camera-controls sees it.
    dom.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown, true);
      endDrag();
    };
  }, [rendererIsReady, store]);
}
