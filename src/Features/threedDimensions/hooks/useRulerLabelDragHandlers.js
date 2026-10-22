import { useEffect, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";
import { Matrix4, Plane, Raycaster, Vector2, Vector3 } from "three";

import db from "App/db/db";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import { isZeroLabelOffset } from "Features/annotations/utils/getRulerSegmentKey";
import {
  selectSelectedItems,
  setSubSelection,
} from "Features/selection/selectionSlice";
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
// Reused as-is (see useCoteLabelDragHandlers): MainThreedEditor's pointerup
// stands down while the flag is on.
import { setMesh3dLabelGestureActive } from "Features/threedMesh/services/mesh3dLabelGestureStore";

import {
  getRulerLabelPartId,
  RULER_LABEL_PART_TYPE,
} from "../utils/rulerLabelPart";
import { getDimensionObjects } from "../services/dimensionObjectsStore";
import getSingleSelectedAnnotationId from "../utils/getSingleSelectedAnnotationId";

// Pointer movement (in CSS px) below which the gesture is treated as a plain
// click (sub-selection of the card, MainThreedEditor's pre-pass) rather than
// a drag.
const DRAG_THRESHOLD_PX = 4;

// A user axis this parallel to the base map normal (|dot|) is off the plane
// of a plane-parallel ruler: no lock on it.
const OFF_PLANE_AXIS_DOT = 0.1;

const round4 = (v) => Math.round(v * 10000) / 10000;

// Dragging a value card of the SELECTED ruler in 3D moves THAT card only
// (an unselected ruler only gets selected by the click, through
// MainThreedEditor's sprite pre-pass — same rule as the cote cards). The
// displacement from the card's default position (the middle of its offset
// segment) is persisted per segment in `rulerLabelOffsets[key]`
// (base-map-local metres), rendered in 3D and in 2D (NodeRulerStatic).
// Mirror of useCoteLabelDragHandlers: the cursor is projected on a
// camera-facing plane through the card, the displacement since the grab
// point is added to the current offset (no jump); with Shift held the cursor
// is locked on the user axis of the gizmo frame (through the grab point)
// closest to it on screen — in-plane axes only for a plane-parallel ruler.
// The sprite and its dashed leader are updated imperatively; the annotation
// is persisted on pointerup (the DB write re-triggers the rebuild), the
// dragged card then stays sub-selected. A card dragged back within 1 mm of
// its default position drops its entry.
export default function useRulerLabelDragHandlers({ rendererIsReady }) {
  const updateAnnotation = useUpdateAnnotation();
  const store = useStore();
  const dispatch = useDispatch();

  // Modes that own the pointer — no label drag while one is active (same
  // list as useCoteLabelDragHandlers).
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
      const sprites = getDimensionObjects("RULER");
      if (!sprites.length) return;
      if (!setRayFromClient(e.clientX, e.clientY)) return;

      const hits = filterIntersectionsByClipping(
        raycaster.intersectObjects(sprites, false),
        getActiveClippingPlane(sceneManager)
      );
      const sprite = hits[0]?.object;
      const annotationId = sprite?.userData?.annotationId;
      if (!annotationId) return;

      // Unselected ruler: the click only selects it (MainThreedEditor's
      // handleClick, sprite pre-pass) — no drag, camera controls stay free.
      const selectedId = getSingleSelectedAnnotationId(
        selectSelectedItems(store.getState())
      );
      if (selectedId !== annotationId) return;

      const group = sprite.parent;
      const entry = group?.userData?.rulerSegments?.find(
        (seg) => seg.sprite === sprite
      );
      if (!entry) return;

      group.updateMatrixWorld(true);
      const midWorld = entry.midLocal.clone().applyMatrix4(group.matrixWorld);

      // Drag plane: through the current card position, facing the camera.
      // The card's offset from its default position is the current
      // displacement vector (the full stored offset).
      const labelWorld = sprite.getWorldPosition(new Vector3());
      const planeNormal = camera.getWorldDirection(new Vector3());
      const plane = new Plane().setFromNormalAndCoplanarPoint(
        planeNormal,
        labelWorld
      );
      const startHit = new Vector3();
      if (!raycaster.ray.intersectPlane(plane, startHit)) return;
      const offsetWorld = labelWorld.clone().sub(midWorld);

      // Shift locks: the user axes of the gizmo frame. A plane-parallel ruler
      // keeps its cards in its plan: the axes lying in that plane only.
      const baseMapNormal = new Vector3(0, 0, 1).transformDirection(
        group.matrixWorld
      );
      const userAxes = getUserAxesWorldDirections(yawDegRef.current);
      const axes = group.userData.rulerGeom?.isPlaneParallel
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
        entry,
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
        // Live value persisted on pointerup (base-map-local metres).
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
        // From here on the card owns the gesture: the pointerup pick path of
        // MainThreedEditor stands down. A click without a move keeps it —
        // the pre-pass then sub-selects the card.
        setMesh3dLabelGestureActive(true);
      }
      const canvasSize = setRayFromClient(clientX, clientY);
      if (!canvasSize) return;

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

      // Current displacement + movement since the grab point — free
      // placement (no component removed: the card is detached from its
      // segment).
      const vWorld = drag.offsetWorld
        .clone()
        .add(hit.clone().sub(drag.startHit));

      // World → basemap-local direction (groups are unscaled, so the length
      // is preserved through the rotation).
      const len = vWorld.length();
      const inv = new Matrix4().copy(drag.group.matrixWorld).invert();
      const vLocal =
        len > 0
          ? vWorld.transformDirection(inv).multiplyScalar(len)
          : new Vector3();
      drag.vLocal = { x: vLocal.x, y: vLocal.y, z: vLocal.z };

      // Live update: card and its leader.
      const { midLocal, sprite, leader } = drag.entry;
      const card = midLocal.clone().add(vLocal);
      sprite.position.copy(card);
      leader.geometry.setPositions([
        midLocal.x,
        midLocal.y,
        midLocal.z,
        card.x,
        card.y,
        card.z,
      ]);
      leader.computeLineDistances();
      leader.visible = !isZeroLabelOffset(drag.vLocal);
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
      if (!drag || !drag.moved || !drag.vLocal) return;
      const { annotationId, entry, vLocal } = drag;
      try {
        // Merge into the RAW row (the rendered annotation is template-merged
        // and may carry resolved points): other cards keep their offsets.
        const raw = await db.annotations.get(annotationId);
        const next = { ...(raw?.rulerLabelOffsets || {}) };
        if (isZeroLabelOffset(vLocal)) {
          delete next[entry.key];
        } else {
          next[entry.key] = {
            x: round4(vLocal.x),
            y: round4(vLocal.y),
            z: round4(vLocal.z),
          };
        }
        await updateAnnotationRef.current({
          id: annotationId,
          rulerLabelOffsets: Object.keys(next).length ? next : null,
        });
        // The dragged card stays the sub-selected one after the rebuild.
        dispatch(
          setSubSelection({
            partId: getRulerLabelPartId(annotationId, entry.key),
            partType: RULER_LABEL_PART_TYPE,
            pointId: null,
          })
        );
      } catch (err) {
        console.error(
          "[threedDimensions] ruler label offset persist failed",
          err
        );
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
  }, [rendererIsReady, store, dispatch]);
}
