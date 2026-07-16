import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { setMeshingShootActive } from "Features/threedEditor/threedEditorSlice";

import { emitShoot } from "../services/shootAimStore";
import { pickWorldTargetAtNdc, getMuzzleOrigin } from "../services/shootPick";
import { createShootSprayController } from "../services/shootSprayController";

const DRAG_THRESHOLD_PX = 4;

// Owns the pointer while meshingMode.shootActive: aim feeds the lance
// overlay (via shootAimStore), a clean click (no drag — camera-controls keeps
// orbiting on drags) fires a 1s concrete burst toward the point under the
// cursor.
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

    let downPos = null;
    let dragging = false;

    const controller = createShootSprayController({ editor, sceneManager });

    dom.style.cursor = "crosshair";

    // World point under the cursor (see pickWorldTargetAtNdc).
    function pickTarget(e) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      return pickWorldTargetAtNdc({ sceneManager, ndcX, ndcY });
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
      controller.fire({ origin: getMuzzleOrigin(sceneManager), target });
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
