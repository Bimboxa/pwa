import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setAxesOrigin,
  setAxesYawDeg,
  setAxesPlacementModeActive,
  setAxesPlacementOriginSet,
} from "Features/threedEditor/threedEditorSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import computeAxesYawFromPoints from "../utils/computeAxesYawFromPoints";

import {
  getLastAxesPlacementSnap,
  getAxesPlacementGrab,
  setAxesPlacementGrab,
  clearAxesPlacementGrab,
} from "../services/axesPlacementSessionStore";

// Mirrors useRotateBaseMapPointerHandlers: a press that moves further than
// this is a camera orbit, not a click.
const DRAG_THRESHOLD_PX = 4;

// Puts the axes helper back to its origin-click pose (Escape / mode exit
// before the commit).
function restoreAxesPose() {
  const grab = getAxesPlacementGrab();
  if (!grab) return;
  const editor = getActiveThreedEditor();
  const axes = editor?.sceneManager?.axes;
  if (axes) {
    axes.position.copy(grab.startPosition);
    axes.rotation.y = grab.startRotationY;
    axes.visible = grab.startVisible;
    editor.renderScene?.();
  }
  clearAxesPlacementGrab();
}

// Wires click + key handlers of the « Orienter le repère » mode — 2 clicks:
// the 1st snapped click sets the frame origin (the axes helper jumps there,
// shown even if the scene axes are hidden), the overlay then rotates the
// helper live around its vertical axis towards the cursor, and the 2nd
// click fixes the X axis direction: origin + yaw are committed to
// threedEditor.axesSettings (device preference) and the mode exits. Esc
// cancels the in-progress placement (helper put back), or exits the mode
// when no origin is set yet.
export default function useAxesPlacementPointerHandlers() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.axesPlacementMode.active);

  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const dom = editor?.sceneManager?.renderer?.domElement;
    if (!dom) return;

    let downPos = null;
    let isDragging = false;

    function onPointerDown(e) {
      if (e.button !== 0) return;
      downPos = { x: e.clientX, y: e.clientY };
      isDragging = false;
    }

    function onPointerMove(e) {
      if (!downPos) return;
      const dx = Math.abs(e.clientX - downPos.x);
      const dy = Math.abs(e.clientY - downPos.y);
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) isDragging = true;
    }

    // 1st click: the frame origin. The helper is posed there right away so
    // the rotation phase shows the real frame turning.
    function setOriginAtSnap(snap) {
      const axes = editor?.sceneManager?.axes;
      if (!axes) return;
      setAxesPlacementGrab({
        origin: snap.position.clone(),
        startPosition: axes.position.clone(),
        startRotationY: axes.rotation.y,
        startVisible: axes.visible,
      });
      axes.position.copy(snap.position);
      axes.visible = true;
      editor.renderScene?.();
      dispatch(setAxesPlacementOriginSet(true));
    }

    // 2nd click: the X axis direction. A click on the origin itself is
    // degenerate — ignored. The committed settings re-pose the helper
    // through MainThreedEditor's sync effect (visibility back to the
    // « Afficher les axes dans la scène » switch).
    function commitDirection(grab, target) {
      const yawDeg = computeAxesYawFromPoints(grab.origin, target.position);
      if (yawDeg == null) return;
      const { origin } = grab;
      clearAxesPlacementGrab();
      dispatch(setAxesOrigin([origin.x, origin.y, origin.z]));
      dispatch(setAxesYawDeg(yawDeg));
      dispatch(setAxesPlacementModeActive(false));
    }

    function onPointerUp(e) {
      if (e.button !== 0) return;
      const wasDrag = isDragging;
      downPos = null;
      isDragging = false;
      if (wasDrag) return;

      const snap = getLastAxesPlacementSnap();
      if (!snap?.position) return;
      const grab = getAxesPlacementGrab();
      if (!grab) setOriginAtSnap(snap);
      else commitDirection(grab, snap);
    }

    function onPointerCancel() {
      downPos = null;
      isDragging = false;
    }

    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== "Escape") return;
      if (getAxesPlacementGrab()) {
        restoreAxesPose();
        dispatch(setAxesPlacementOriginSet(false));
      } else {
        dispatch(setAxesPlacementModeActive(false));
      }
    }

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    // Capture phase, like the other 3D tool modes: Escape must reach this
    // mode before the window-scoped shortcuts of the other features.
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown, true);
      // Leaving the mode mid-placement: put the helper back.
      restoreAxesPose();
    };
  }, [active, dispatch]);
}
