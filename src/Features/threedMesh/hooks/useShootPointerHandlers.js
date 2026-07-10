import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";
import { Raycaster, Vector2 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { setMeshingShootActive } from "Features/threedEditor/threedEditorSlice";
import {
  getActiveClippingPlane,
  filterIntersectionsByClipping,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { filterIntersectionsByVisibility } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";

import { createShootSprayController } from "../services/shootSprayController";

const DRAG_THRESHOLD_PX = 4;
const VOID_TARGET_DIST = 30; // spray reach when the click hits nothing
const MUZZLE_DIST = 0.6; // spray origin, in front of the camera near plane

// --- Lance aim store -------------------------------------------------------
// Tiny external store connecting this hook (imperative pointer code) to the
// ShootLanceOverlayThreed DOM overlay. `aim` is px relative to the 3D canvas;
// `firingUntil` re-arms the recoil animation on each shot.

let _state = { aim: null, firingUntil: 0 };
const _listeners = new Set();

function emitShoot(partial) {
  _state = { ..._state, ...partial };
  _listeners.forEach((listener) => listener());
}

export function getShootState() {
  return _state;
}

export function subscribeShoot(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

// --- Pointer handlers ------------------------------------------------------
// Owns the pointer while meshingMode.shootActive: aim feeds the lance
// overlay, a clean click (no drag — camera-controls keeps orbiting on drags)
// fires a 1s concrete burst toward the point under the cursor.
export default function useShootPointerHandlers() {
  const dispatch = useDispatch();

  const meshingActive = useSelector((s) => s.threedEditor.meshingMode.active);
  const shootActive = useSelector(
    (s) => s.threedEditor.meshingMode.shootActive
  );
  const active = meshingActive && shootActive;

  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    if (!sceneManager || !dom) return;

    const raycaster = new Raycaster();
    const mouse = new Vector2();
    let downPos = null;
    let dragging = false;

    const controller = createShootSprayController({ editor, sceneManager });

    dom.style.cursor = "crosshair";

    // World point under the cursor: first mesh hit (clipping/visibility
    // aware, fat lines excluded — same filter as useMeshingPointerHandlers'
    // pickScene), else a far point along the mouse ray.
    function pickTarget(e) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, sceneManager.camera);
      const clippingPlane = getActiveClippingPlane(sceneManager);

      const targets = [];
      sceneManager.scene.traverse((obj) => {
        if (obj.isMesh && !obj.isLine2 && !obj.isLineSegments2) {
          targets.push(obj);
        }
      });

      const intersects = filterIntersectionsByVisibility(
        filterIntersectionsByClipping(
          raycaster.intersectObjects(targets, false),
          clippingPlane
        )
      );

      if (intersects.length) return intersects[0].point.clone();
      return raycaster.ray.origin
        .clone()
        .addScaledVector(raycaster.ray.direction, VOID_TARGET_DIST);
    }

    // Spray origin: bottom-center of the screen, just in front of the camera
    // — matches the lance muzzle of the DOM overlay.
    function getOrigin() {
      raycaster.setFromCamera(new Vector2(0, -0.85), sceneManager.camera);
      return raycaster.ray.origin
        .clone()
        .addScaledVector(raycaster.ray.direction, MUZZLE_DIST);
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      downPos = { x: e.clientX, y: e.clientY };
      dragging = false;
    }

    function onPointerMove(e) {
      const rect = dom.getBoundingClientRect();
      emitShoot({
        aim: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      });
      if (!downPos) return;
      const dx = Math.abs(e.clientX - downPos.x);
      const dy = Math.abs(e.clientY - downPos.y);
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) dragging = true;
    }

    function onPointerUp(e) {
      if (e.button !== 0) return;
      const wasDrag = dragging;
      downPos = null;
      dragging = false;
      if (wasDrag) return;

      const target = pickTarget(e);
      if (!target) return;
      controller.fire({ origin: getOrigin(), target });
      emitShoot({ firingUntil: Date.now() + 1000 });
    }

    function onPointerCancel() {
      downPos = null;
      dragging = false;
    }

    function onPointerLeave() {
      emitShoot({ aim: null });
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        // Leaves meshing mode itself open — shoot is a sub-toggle.
        dispatch(setMeshingShootActive(false));
      }
    }

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    dom.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      dom.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown);
      controller.dispose();
      emitShoot({ aim: null, firingUntil: 0 });
      dom.style.cursor = "";
    };
  }, [active, dispatch]);
}
