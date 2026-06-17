import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  clearDimensionDraft,
  setDimensionStartPoint,
} from "Features/threedEditor/threedEditorSlice";

import { getLastDimensionSnap } from "../services/lastDimensionSnapStore";
import useCreateDimension3d from "./useCreateDimension3d";

// Pointer movement (in CSS px) above which a press-release pair is treated as
// a camera drag and NOT as a point commit. Mirrors useDrawingPointerHandlers.
const DRAG_THRESHOLD_PX = 4;

// Wires click + key handlers for the dimension ("cote") tool. A point is
// committed on pointerup only when (a) the pointer hasn't moved past
// DRAG_THRESHOLD_PX and (b) the cursor is snapped to a mesh vertex/segment.
// First commit sets the start point; second commit creates the cote and resets
// the draft. Esc cancels the in-progress draft.
export default function useDimensionPointerHandlers() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.dimensionMode.active);
  const startPoint = useSelector(
    (s) => s.threedEditor.dimensionMode.startPoint
  );

  const createDimension3d = useCreateDimension3d();

  const downPosRef = useRef(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const dom = editor?.sceneManager?.renderer?.domElement;
    if (!dom) return;

    function onPointerDown(e) {
      if (e.button !== 0) return;
      downPosRef.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = false;
    }

    function onPointerMove(e) {
      if (!downPosRef.current) return;
      const dx = Math.abs(e.clientX - downPosRef.current.x);
      const dy = Math.abs(e.clientY - downPosRef.current.y);
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
        isDraggingRef.current = true;
      }
    }

    async function onPointerUp(e) {
      if (e.button !== 0) return;
      const wasDrag = isDraggingRef.current;
      downPosRef.current = null;
      isDraggingRef.current = false;
      if (wasDrag) return;

      const snap = getLastDimensionSnap();
      if (!snap?.position) return; // snap-to-mesh only — ignore free clicks

      const point = {
        x: snap.position.x,
        y: snap.position.y,
        z: snap.position.z,
      };

      if (!startPoint) {
        dispatch(setDimensionStartPoint(point));
        return;
      }

      try {
        await createDimension3d({ a: startPoint, b: point });
      } catch (err) {
        console.error("[threedDimensions] create failed", err);
      }
      dispatch(clearDimensionDraft());
    }

    function onPointerCancel() {
      downPosRef.current = null;
      isDraggingRef.current = false;
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        dispatch(clearDimensionDraft());
      }
    }

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, startPoint, createDimension3d, dispatch]);
}
