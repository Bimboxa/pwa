import { useRef, useState } from "react";

import { COL_WIDTH, ROW_HEIGHT } from "../constants/planningDefaults";

const DRAG_THRESHOLD_PX = 3;

// Native pointer drag of a planning block: "move" (horizontal = steps,
// vertical = resource row) or "resize" (right edge = steps). Returns a
// preview {slotId, startStep, steps, rowIndex} while dragging (the grid
// renders the block at the previewed place), commits through `onCommit`
// on release, and reports a plain click (no drag) through `onClick`.
// No dnd-kit: the app-wide DndContext sensor has a 250 ms delay.
export default function useSlotPointerDrag({ rowCount, onCommit, onClick }) {
  const [preview, setPreview] = useState(null);
  const dragRef = useRef(null);

  function startDrag(e, { slot, mode, rowIndex }) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const start = {
      slot,
      mode,
      rowIndex,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      last: null,
    };
    dragRef.current = start;

    function onMove(ev) {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (
        !d.moved &&
        Math.abs(dx) < DRAG_THRESHOLD_PX &&
        Math.abs(dy) < DRAG_THRESHOLD_PX
      )
        return;
      d.moved = true;
      const dSteps = Math.round(dx / COL_WIDTH);
      const dRows = Math.round(dy / ROW_HEIGHT);
      let next;
      if (d.mode === "resize") {
        next = {
          slotId: d.slot.id,
          startStep: d.slot.startStep,
          steps: Math.max(1, d.slot.steps + dSteps),
          rowIndex: d.rowIndex,
        };
      } else {
        next = {
          slotId: d.slot.id,
          startStep: Math.max(0, d.slot.startStep + dSteps),
          steps: d.slot.steps,
          rowIndex: Math.min(Math.max(d.rowIndex + dRows, 0), rowCount - 1),
        };
      }
      d.last = next;
      setPreview(next);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;
      if (!d.moved) {
        setPreview(null);
        onClick?.(d.slot);
        return;
      }
      const last = d.last;
      const changed =
        last &&
        (last.startStep !== d.slot.startStep ||
          last.steps !== d.slot.steps ||
          last.rowIndex !== d.rowIndex);
      if (changed) {
        Promise.resolve(onCommit?.(d.slot, last)).finally(() =>
          setPreview(null)
        );
      } else {
        setPreview(null);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return { preview, startDrag, isDragging: Boolean(preview) };
}
