import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";
import { Matrix4, Plane, Raycaster, Vector2, Vector3 } from "three";

import db from "App/db/db";
import { getImageCardMoveUpdates } from "Features/imageAnnotations/utils/imageConnector";
import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import { setToaster } from "Features/layout/layoutSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import getAnnotationLabelDeltaFromDeltaPos from "Features/annotations/utils/getAnnotationLabelDeltaFromDeltaPos";
import {
  buildAnnotationLabelSelectionItem,
  getSelectedAnnotationIds,
} from "Features/annotations/utils/annotationLabelSelection";
import {
  setSelectedNode,
  setAnnotationToolbarPosition,
  setAnnotationsToolbarPosition,
} from "Features/mapEditor/mapEditorSlice";
import {
  setSelectedItem,
  selectSelectedItems,
} from "Features/selection/selectionSlice";
import {
  buildAxisLockLine,
  removeAxisLockLine,
} from "Features/threedDrawing/utils/axisLockLine";
import {
  closestPointOnAxis,
  ndcDistance,
} from "Features/threedDrawing/utils/computeSnapTarget";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { clearSubSelection } from "Features/threedEditor/threedEditorSlice";
import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";
import createMesh3dLabelLeader, {
  setMesh3dLabelLeaderEnds,
} from "Features/threedMesh/services/createMesh3dLabelLeader";
// Reused as-is: the flag's consumers (MainThreedEditor pointerup, meshing
// pointer handlers) must stand down for an annotation label gesture exactly
// like for a maille label one — same semantics, zero extra edits.
import { setMesh3dLabelGestureActive } from "Features/threedMesh/services/mesh3dLabelGestureStore";

import {
  getAnnotationLabelSprites,
  getAnnotationLabelTargetHandles,
} from "../services/annotationLabelObjectsStore";

// Pointer movement (CSS px) below which the gesture stays a plain click
// (selection only) — mirrors useMesh3dLabelDragHandlers.
const DRAG_THRESHOLD_PX = 4;

// Below this |ray · n| the basemap plane is seen edge-on: the ray/plane
// intersection runs away to infinity, so the move is ignored.
const MIN_RAY_PLANE_DOT = 0.05;

// Screen distance (CSS px) under which the cursor is "on" a user axis
// through the grab point — the drawing's axis lock (computeSnapTarget).
const AXIS_THRESHOLD_PX = 20;

const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Click + drag of an annotation label card (and of the pointed end of its
 * leader) in the 3D view — near-copy of useMesh3dLabelDragHandlers:
 * - pointerdown on a card selects the annotation on pointerup (shift+click
 *   toggles);
 * - dragging the card / target handle moves it WITHIN THE BASEMAP PLANE, or
 *   ALONG A USER AXIS (X / Y / Z of the gizmo frame, drawing parity) when
 *   the cursor is close to one on screen — the axis is drawn in its colour.
 *   The vertical axis lets the card leave the plane (its lift above the
 *   anchor, `labelLift3d`); the target handle stays in the plane;
 * - pointerup converts the in-plane displacement to image-px deltas and
 *   persists it through getAnnotationLabelDeltaFromDeltaPos — the exact 2D
 *   commit path (MainMapEditorV3), so both views share the same labelDelta;
 *   the out-of-plane displacement goes to `labelLift3d` (meters).
 * IMAGE cards select the annotation itself, save bbox/imageLift3d and leave
 * their target fixed. Vertical photos move in the camera-facing plane;
 * horizontal photos move in the basemap plane. Their axis lock requires Shift.
 */
export default function useAnnotationLabelDragHandlers({
  rendererIsReady,
  annotations,
}) {
  const dispatch = useDispatch();
  const { canEditAnnotation } = useAnnotationPermissions({ annotations });

  // Modes that own the pointer (same list as useMesh3dLabelDragHandlers).
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

  // Yaw of the displayed axes frame: the axis locks follow the gizmo axes
  // (same as the 3D drawing). Read in the handlers through a ref.
  const yawDeg = useSelector((s) => s.threedEditor.axesSettings?.yawDeg ?? 0);
  const yawDegRef = useRef(yawDeg);
  yawDegRef.current = yawDeg;

  // Currently-selected annotation id — a label is only draggable once its
  // annotation (or the label itself, ANNOTATION_LABEL) is selected (same
  // rule as the 2D editor).
  const selectedItems = useSelector(selectSelectedItems);
  const selectedAnnotationIdRef = useRef(null);
  selectedAnnotationIdRef.current =
    selectedItems.length === 1
      ? (getSelectedAnnotationIds(selectedItems)[0] ?? null)
      : null;

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

    function setRayFromEvent(e) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      return true;
    }

    // Cursor projected on the basemap plane through the dragged object.
    function pickOnPlane(e, plane) {
      if (!setRayFromEvent(e)) return null;
      const dir = raycaster.ray.direction;
      if (Math.abs(dir.dot(plane.normal)) < MIN_RAY_PLANE_DOT) return null;
      const hit = new Vector3();
      return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
    }

    // Cursor snapped on the user axis through the grab point closest to it
    // on screen (within AXIS_THRESHOLD_PX): { position, axis } or null.
    function pickOnAxes(e, drag) {
      if (!drag.axes.length || !setRayFromEvent(e)) return null;
      const rect = dom.getBoundingClientRect();
      const canvasSize = { width: rect.width, height: rect.height };
      const { origin, direction } = raycaster.ray;
      let best = null;
      let bestDist = drag.isImage ? Infinity : AXIS_THRESHOLD_PX;
      for (const ax of drag.axes) {
        const pt = closestPointOnAxis(origin, direction, drag.startHit, ax.dir);
        if (!pt) continue;
        const { distance, behind } = ndcDistance(pt, ndc, camera, canvasSize);
        if (behind || distance >= bestDist) continue;
        bestDist = distance;
        best = { position: pt, axis: ax.key };
      }
      return best;
    }

    function removeAxisLine(drag) {
      if (!drag?.axisLine) return;
      removeAxisLockLine(drag.axisLine);
      drag.axisLine = null;
      drag.axis = null;
    }

    // Dashed line along the locked axis through the dragged object, in the
    // axis colour (drawing overlay look). Static for a given axis.
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
        origin: drag.startWorld,
        dir,
        axis,
      });
      if (!line) return;
      sceneManager.scene.add(line);
      drag.axisLine = line;
      drag.axis = axis;
    }

    function restoreDrag(drag) {
      if (!drag || drag.clickOnly) return;
      drag.dragged.position.copy(drag.startLocal);
      if (drag.kind === "TARGET")
        drag.sprite.userData.anchorDot?.position.copy(drag.startLocal);
      setMesh3dLabelLeaderEnds(
        drag.leader,
        drag.kind === "TARGET" ? drag.startLocal : drag.fixedEnd,
        drag.kind === "LABEL" ? drag.startLocal : drag.fixedEnd
      );
    }

    function endDrag(cancel = false) {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag) {
        if (cancel) restoreDrag(drag);
        const controls = sceneManager.controlsManager?.orbitControls;
        if (controls && drag.prevControlsEnabled) controls.enabled = true;
        if (drag.tempLeader) {
          drag.dragged.parent?.remove(drag.tempLeader);
          drag.tempLeader.geometry?.dispose();
          drag.tempLeader.material?.dispose();
        }
        removeAxisLine(drag);
        sceneManager.renderScene?.();
      }
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onWindowPointerCancel);
      return drag;
    }

    function isVisible(object) {
      for (let parent = object; parent; parent = parent.parent) {
        if (!parent.visible) return false;
        if (parent === sceneManager.scene) return true;
      }
      return false;
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      if (blockedRef.current) return;
      if (!setRayFromEvent(e)) return;

      // Target handles first: they are smaller than the card and may overlap
      // it (both ends sit on the barycenter until one is moved).
      const handles = getAnnotationLabelTargetHandles().filter(isVisible);
      let kind = "TARGET";
      let dragged = handles.length
        ? raycaster.intersectObjects(handles, false)[0]?.object
        : null;
      if (!dragged) {
        const sprites = getAnnotationLabelSprites().filter(isVisible);
        if (!sprites.length) return;
        kind = "LABEL";
        dragged = raycaster.intersectObjects(sprites, false)[0]?.object;
      }

      const annotationId = dragged?.userData?.annotationId;
      const sprite =
        kind === "LABEL" ? dragged : dragged?.userData?.labelSprite;
      const group = dragged?.parent;
      if (!annotationId || !sprite || !group) return;

      // Unselected label: the gesture is click-only (selection on pointerup,
      // no drag, camera controls stay free) — same rule as the 2D editor.
      const clickOnly =
        selectedAnnotationIdRef.current !== annotationId ||
        !canEditAnnotation(annotationId, { silent: true });
      const isImage = Boolean(sprite.userData.isImageAnnotationCard);

      // The card owns the gesture from here on (the pointerup pick paths are
      // told to stand down, see mesh3dLabelGestureStore). Selection is
      // dispatched on pointerup, NOT here: it re-runs the
      // ThreedAnnotationLabels rebuild, which would dispose the very sprite
      // being dragged.
      setMesh3dLabelGestureActive(true);

      group.updateMatrixWorld(true);
      const planeNormal = new Vector3(0, 0, 1).transformDirection(
        group.matrixWorld
      );
      const moveNormal =
        isImage &&
        sprite.userData.imageOrientation3d !== "HORIZONTAL" &&
        kind === "LABEL"
          ? camera.getWorldDirection(new Vector3())
          : planeNormal;
      const startWorld = dragged.getWorldPosition(new Vector3());
      const plane = new Plane().setFromNormalAndCoplanarPoint(
        moveNormal,
        startWorld
      );
      const startHit = pickOnPlane(e, plane);

      // Axis locks: the user axes of the gizmo frame. The target handle
      // stays on the annotation — only the axes lying in the basemap plane.
      const userAxes = getUserAxesWorldDirections(yawDegRef.current);
      const axes =
        kind === "LABEL"
          ? userAxes
          : userAxes.filter((a) => Math.abs(a.dir.dot(planeNormal)) < 1e-3);

      const controls = sceneManager.controlsManager?.orbitControls;
      const prevControlsEnabled = controls?.enabled ?? true;
      if (controls && !clickOnly) controls.enabled = false;

      const startLocal =
        kind === "LABEL"
          ? sprite.userData.labelLocal
          : sprite.userData.targetLocal;
      // The end that stays put during this drag — the other leader endpoint.
      const fixedEnd =
        kind === "LABEL"
          ? sprite.userData.targetLocal
          : sprite.userData.labelLocal;

      dragRef.current = {
        kind,
        isImage,
        pointerId: e.pointerId,
        partType: kind === "LABEL" ? "LABEL_BOX" : "TARGET",
        clickOnly,
        annotationId,
        dragged,
        sprite,
        group,
        plane,
        startWorld,
        startHit,
        startLocal,
        fixedEnd,
        axes,
        axis: null,
        axisLine: null,
        deltaLocal: null,
        meterByPx: sprite.userData.meterByPx || 0.01,
        liftM: sprite.userData.liftM || 0,
        leader: sprite.userData.leader || null,
        tempLeader: null,
        prevControlsEnabled,
        startClient: { x: e.clientX, y: e.clientY },
        moved: false,
      };

      window.addEventListener("pointermove", onWindowPointerMove);
      window.addEventListener("pointerup", onWindowPointerUp);
      window.addEventListener("pointercancel", onWindowPointerCancel);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("blur", onWindowPointerCancel);

      if (!clickOnly) e.preventDefault();
    }

    function onWindowPointerMove(e) {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId || !drag.startHit) return;
      if (!drag.moved) {
        const dx = Math.abs(e.clientX - drag.startClient.x);
        const dy = Math.abs(e.clientY - drag.startClient.y);
        if (dx <= DRAG_THRESHOLD_PX && dy <= DRAG_THRESHOLD_PX) return;
        drag.moved = true;
        if (!drag.clickOnly) dom.style.cursor = "grabbing";
      }
      // Click-only gesture: never drags — only tracks `moved` so a camera
      // orbit started on an unselected card doesn't select it on pointerup.
      if (drag.clickOnly) return;

      // Axis lock first (through the cursor's grab point, so the card keeps
      // its grab offset), else free move in the basemap plane.
      const axisHit = !drag.isImage || e.shiftKey ? pickOnAxes(e, drag) : null;
      const hit = axisHit?.position ?? pickOnPlane(e, drag.plane);
      if (!hit) return;
      updateAxisLine(drag, axisHit?.axis ?? null);

      // World displacement since pointerdown → basemap-local (groups are
      // unscaled, so the length is preserved through the rotation). z is
      // the lift above the plane (vertical axis lock on a horizontal map).
      const vWorld = hit.clone().sub(drag.startHit);
      const len = vWorld.length();
      const inv = new Matrix4().copy(drag.group.matrixWorld).invert();
      const vLocal = vWorld.transformDirection(inv).multiplyScalar(len);
      if (drag.kind === "TARGET") vLocal.z = 0;
      drag.deltaLocal = { x: vLocal.x, y: vLocal.y, z: vLocal.z };

      const position = new Vector3(
        drag.startLocal.x + vLocal.x,
        drag.startLocal.y + vLocal.y,
        drag.startLocal.z + vLocal.z
      );
      drag.dragged.position.copy(position);

      // Dragging the target: keep the fixed-size anchor marker on it.
      if (drag.kind === "TARGET") {
        drag.sprite.userData.anchorDot?.position.copy(position);
      }

      // Leader line: reuse the one built by ThreedAnnotationLabels, or add a
      // temporary one when both ends still sat on the same point.
      if (
        drag.sprite.userData.hasConnector &&
        !drag.leader &&
        !drag.tempLeader &&
        drag.dragged.parent
      ) {
        drag.tempLeader = createMesh3dLabelLeader({
          from: drag.fixedEnd,
          to: position,
          depthTest: true,
        });
        drag.dragged.parent.add(drag.tempLeader);
      }
      const leader = drag.leader || drag.tempLeader;
      // The leader always runs target → card.
      if (drag.kind === "LABEL") {
        setMesh3dLabelLeaderEnds(leader, drag.fixedEnd, position);
      } else {
        setMesh3dLabelLeaderEnds(leader, position, drag.fixedEnd);
      }

      sceneManager.renderScene?.();
    }

    async function onWindowPointerUp(e) {
      if (dragRef.current?.pointerId !== e.pointerId) return;
      const drag = endDrag();
      dom.style.cursor = "";
      // Released after the canvas-level pointerup listeners have run.
      setMesh3dLabelGestureActive(false);
      if (!drag) return;

      // Click-only gesture that turned into a camera orbit: no selection.
      if (drag.clickOnly && drag.moved) return;

      // Selection (click OR drag end) — safe here: the rebuild it triggers
      // now happens after the gesture. Clicking a label card selects the
      // LABEL (ANNOTATION_LABEL item → Etiquette panel), same as the 2D chip.
      // Always a single replace: a label never joins a multi-selection.
      const { annotationType, listingId, annotationTemplateId } =
        drag.sprite.userData;
      const item = drag.isImage
        ? {
            id: drag.annotationId,
            nodeId: drag.annotationId,
            nodeType: "ANNOTATION",
            type: "NODE",
            annotationType,
            listingId,
            annotationTemplateId,
          }
        : buildAnnotationLabelSelectionItem({
            annotation: {
              id: drag.annotationId,
              type: annotationType,
              listingId,
              annotationTemplateId,
            },
          });
      const position = { x: e.clientX, y: e.clientY };
      dispatch(
        setSelectedNode({
          id: drag.annotationId,
          nodeId: drag.annotationId,
          nodeType: "ANNOTATION",
          annotationType,
          listingId,
        })
      );
      dispatch(setSelectedItem(item));
      dispatch(clearSubSelection());
      dispatch(setAnnotationToolbarPosition(position));
      dispatch(setAnnotationsToolbarPosition(position));

      if (!drag.moved || !drag.deltaLocal) return;
      try {
        // Basemap-local meters → image px (pixel y axis points down).
        const deltaPos = {
          x: round2(drag.deltaLocal.x / drag.meterByPx),
          y: round2(-drag.deltaLocal.y / drag.meterByPx),
        };
        const annotation = await db.annotations.get(drag.annotationId);
        if (!annotation) return;
        if (!canEditAnnotation(drag.annotationId)) {
          restoreDrag(drag);
          return;
        }
        if (drag.isImage) {
          const changes = getImageCardMoveUpdates(
            annotation,
            drag.deltaLocal,
            drag.sprite.userData.imageSize,
            drag.meterByPx,
            drag.kind === "TARGET"
          );
          if (changes) await db.annotations.update(drag.annotationId, changes);
          dispatch(triggerAnnotationsUpdate());
          return;
        }
        const labelDelta = getAnnotationLabelDeltaFromDeltaPos(
          annotation,
          deltaPos,
          drag.partType
        );
        const changes = { labelDelta };
        // Card moved out of the plane (vertical axis lock): its lift above
        // the anchor, 3D only.
        if (drag.kind === "LABEL" && Math.abs(drag.deltaLocal.z) > 1e-4) {
          changes.labelLift3d = round2(drag.liftM + drag.deltaLocal.z);
        }
        await db.annotations.update(drag.annotationId, changes);
        dispatch(triggerAnnotationsUpdate());
      } catch (err) {
        restoreDrag(drag);
        sceneManager.renderScene?.();
        dispatch(
          setToaster({
            message: "Le déplacement n’a pas pu être enregistré.",
            isError: true,
          })
        );
        console.error(
          "[threedAnnotationLabels] label delta persist failed",
          err
        );
      }
    }

    function onWindowPointerCancel() {
      endDrag(true);
      dom.style.cursor = "";
      setMesh3dLabelGestureActive(false);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") onWindowPointerCancel();
    }

    // Capture phase so the hit-test runs before the camera controls' own
    // pointerdown work (disabling the controls is what actually keeps the
    // camera still — see useCoteLabelDragHandlers).
    dom.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown, true);
      endDrag(true);
      dom.style.cursor = "";
      setMesh3dLabelGestureActive(false);
    };
  }, [rendererIsReady, dispatch, canEditAnnotation]);
}
