import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Plane, Raycaster, Vector2, Vector3 } from "three";

import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import resyncRevolutionAxisPlacementsService from "Features/elevation/services/resyncRevolutionAxisPlacementsService";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { setMesh3dLabelGestureActive } from "Features/threedMesh/services/mesh3dLabelGestureStore";
import { getRevolutionAxisHandles } from "Features/revolutionAxes/services/revolutionAxisHandlesStore";
import poseObjectAboutLocalZ from "Features/revolutionAxes/utils/poseObjectAboutLocalZ";
import getRevolutionAxisCutTheta from "Features/revolutionAxes/utils/getRevolutionAxisCutTheta";

const DRAG_THRESHOLD_PX = 3;
// Reject rays nearly parallel to the base map plane (plane seen edge-on).
const MIN_RAY_PLANE_DOT = 0.05;
// Shift: the direction snaps to this step (degrees).
const SNAP_STEP_DEG = 15;
const RAD_TO_DEG = 180 / Math.PI;

// Fold an angle into (-180, 180] (same as applyDeltaPosToAnnotation).
const normalizeDeg = (deg) => {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
};

/**
 * Drag of the 3D cut-axis rotation handles of the selected plan
 * REVOLUTION_AXIS (built by ThreedRevolutionAxisHandles): the handle follows
 * the cursor on the axis's base map plane and the cut diameter turns around
 * the centre — `directionDeg` in the plan local frame (y up, CCW from +X),
 * the end held staying under the cursor (its antipode for the second
 * handle), Shift snapping to 15°. Live preview = rigid rotation of the axis
 * object (its half-view split turns with the diameter) and of the handles
 * about the centre (poseObjectAboutLocalZ); release persists `directionDeg`
 * (same write + vertical base map re-pose as the 2D ROTATE handles) and the
 * rebuild replaces the posed object. Escape cancels.
 *
 * Pointer ownership mirrors useAnnotationLabelDragHandlers: capture-phase
 * pointerdown on the canvas (handles raycast explicitly — Sprites are
 * invisible to the annotation pick), camera controls disabled for the
 * gesture, mesh3dLabelGestureStore flag so MainThreedEditor's pointerup
 * pick stands down, window-level move / up / cancel.
 */
export default function useRevolutionAxisHandleDragHandlers({
  rendererIsReady,
}) {
  const dispatch = useDispatch();

  // Modes that own the pointer (same list as the label drag).
  const meshingActive = useSelector((s) => s.threedEditor.meshingMode.active);
  const meshingTool = useSelector((s) => s.threedEditor.meshingMode.tool);
  const dimensionActive = useSelector(
    (s) => s.threedEditor.dimensionMode.active
  );
  const drawingActive = useSelector((s) => s.threedEditor.drawingMode.active);
  const walkActive = useSelector((s) => s.threedEditor.walkMode?.active);
  const extrudeActive = useSelector((s) => s.threedEditor.extrudeMode?.active);
  const blockedRef = useRef(false);
  blockedRef.current = Boolean(
    dimensionActive ||
    drawingActive ||
    walkActive ||
    extrudeActive ||
    (meshingActive && meshingTool !== "SELECT")
  );

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
    let hoverCursor = false;

    function setRayFromEvent(e) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      return true;
    }

    function pickHandle(e) {
      const handles = getRevolutionAxisHandles();
      if (!handles.length || !setRayFromEvent(e)) return null;
      return raycaster.intersectObjects(handles, false)[0]?.object ?? null;
    }

    function pickOnPlane(e, plane) {
      if (!setRayFromEvent(e)) return null;
      if (
        Math.abs(raycaster.ray.direction.dot(plane.normal)) < MIN_RAY_PLANE_DOT
      )
        return null;
      const hit = new Vector3();
      return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
    }

    // Preview pose of the axis object + handles for a direction delta.
    function applyPreview(drag, directionDeg) {
      const phi = (directionDeg - drag.directionDeg0) / RAD_TO_DEG;
      // An explicit sector is absolute in the plan frame: only the handles
      // turn (the sector outline must not).
      if (drag.axisObject && !drag.partialRevolution) {
        poseObjectAboutLocalZ(drag.axisObject, drag.center, phi);
      }
      poseObjectAboutLocalZ(drag.handlesGroup, drag.center, phi);
      sceneManager.renderScene?.();
    }

    function resetPreview(drag) {
      if (drag.axisObject && !drag.partialRevolution) {
        poseObjectAboutLocalZ(drag.axisObject, drag.center, 0);
      }
      if (drag.handlesGroup)
        poseObjectAboutLocalZ(drag.handlesGroup, drag.center, 0);
      sceneManager.renderScene?.();
    }

    function endDrag() {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag) {
        const controls = sceneManager.controlsManager?.orbitControls;
        if (controls && drag.prevControlsEnabled) controls.enabled = true;
      }
      dom.style.cursor = "";
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerCancel);
      window.removeEventListener("keydown", onKeyDown, true);
      setMesh3dLabelGestureActive(false);
      return drag;
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      if (blockedRef.current) return;
      const handle = pickHandle(e);
      if (!handle) return;
      const { annotationId, baseMapId, sign, center } = handle.userData;
      const handlesGroup = handle.parent;
      const baseMapGroup = handlesGroup?.parent;
      if (!annotationId || !handlesGroup || !baseMapGroup) return;

      const annotationsManager = sceneManager.annotationsManager;
      const source = annotationsManager?.getAnnotationSource?.(annotationId);
      const axisObject =
        annotationsManager?.annotationsObjectsMap?.[annotationId] ?? null;
      if (!source) return;

      baseMapGroup.updateMatrixWorld(true);
      const planeNormal = new Vector3(0, 0, 1).transformDirection(
        baseMapGroup.matrixWorld
      );
      const plane = new Plane().setFromNormalAndCoplanarPoint(
        planeNormal,
        handle.getWorldPosition(new Vector3())
      );

      // The handles only exist on the selected axis: the gesture owns the
      // pointer from here (no click-only case).
      setMesh3dLabelGestureActive(true);
      const controls = sceneManager.controlsManager?.orbitControls;
      const prevControlsEnabled = controls?.enabled ?? true;
      if (controls) controls.enabled = false;

      dragRef.current = {
        annotationId,
        baseMapId,
        sign,
        center,
        plane,
        baseMapGroup,
        handlesGroup,
        axisObject,
        partialRevolution: Boolean(source.partialRevolution),
        invertHalf: Boolean(source.invertHalf),
        directionDeg0: Number(source.directionDeg) || 0,
        thetaEff0: getRevolutionAxisCutTheta(source),
        directionDeg: Number(source.directionDeg) || 0,
        prevControlsEnabled,
        startClient: { x: e.clientX, y: e.clientY },
        moved: false,
      };

      window.addEventListener("pointermove", onWindowPointerMove);
      window.addEventListener("pointerup", onWindowPointerUp);
      window.addEventListener("pointercancel", onWindowPointerCancel);
      window.addEventListener("keydown", onKeyDown, true);
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    function onWindowPointerMove(e) {
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.moved) {
        const dx = Math.abs(e.clientX - drag.startClient.x);
        const dy = Math.abs(e.clientY - drag.startClient.y);
        if (dx <= DRAG_THRESHOLD_PX && dy <= DRAG_THRESHOLD_PX) return;
        drag.moved = true;
        dom.style.cursor = "grabbing";
      }
      const hit = pickOnPlane(e, drag.plane);
      if (!hit) return;
      const local = drag.baseMapGroup.worldToLocal(hit.clone());
      const dx = local.x - drag.center.x;
      const dy = local.y - drag.center.y;
      if (Math.hypot(dx, dy) < 1e-6) return;
      // Angle of the held end → effective diameter direction (the second
      // handle is the antipode) → stored directionDeg (invertHalf unfolded).
      const alpha = Math.atan2(dy, dx);
      const thetaEff = alpha - (drag.sign < 0 ? Math.PI : 0);
      let directionDeg = normalizeDeg(
        thetaEff * RAD_TO_DEG - (drag.invertHalf ? 180 : 0)
      );
      if (e.shiftKey) {
        directionDeg = normalizeDeg(
          Math.round(directionDeg / SNAP_STEP_DEG) * SNAP_STEP_DEG
        );
      }
      drag.directionDeg = Math.round(directionDeg * 1e3) / 1e3;
      applyPreview(drag, drag.directionDeg);
    }

    async function onWindowPointerUp() {
      const drag = endDrag();
      if (!drag) return;
      const changed =
        drag.moved &&
        Math.abs(normalizeDeg(drag.directionDeg - drag.directionDeg0)) > 1e-3;
      if (!changed) {
        resetPreview(drag);
        return;
      }
      try {
        // Same write as the 2D ROTATE handle (MainMapEditorV3
        // handleAnnotationMoveCommit): the direction, then the vertical base
        // maps posed from this axis follow. The preview pose stays until the
        // rebuild replaces the axis object (and the handles are rebuilt from
        // the new direction).
        await db.annotations.update(drag.annotationId, {
          directionDeg: drag.directionDeg,
        });
        await resyncRevolutionAxisPlacementsService({
          axisId: drag.annotationId,
          dispatch,
        });
        dispatch(triggerAnnotationsUpdate());
      } catch (err) {
        console.error("[revolutionAxes] 3D cut-axis rotation failed", err);
        resetPreview(drag);
      }
    }

    function onWindowPointerCancel() {
      const drag = endDrag();
      if (drag) resetPreview(drag);
    }

    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      const drag = endDrag();
      if (!drag) return;
      e.preventDefault();
      e.stopPropagation();
      resetPreview(drag);
    }

    // Hover cursor over a handle (outside a drag).
    function onDomPointerMove(e) {
      if (dragRef.current || blockedRef.current) return;
      const over = Boolean(pickHandle(e));
      if (over && !hoverCursor) {
        hoverCursor = true;
        dom.style.cursor = "grab";
      } else if (!over && hoverCursor) {
        hoverCursor = false;
        if (dom.style.cursor === "grab") dom.style.cursor = "";
      }
    }

    // Capture phase so the hit-test runs before the camera controls' own
    // pointerdown work (see useAnnotationLabelDragHandlers).
    dom.addEventListener("pointerdown", onPointerDown, true);
    dom.addEventListener("pointermove", onDomPointerMove);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown, true);
      dom.removeEventListener("pointermove", onDomPointerMove);
      const drag = endDrag();
      if (drag) resetPreview(drag);
    };
  }, [rendererIsReady, dispatch]);
}
