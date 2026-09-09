import { useRef, useState } from "react";

import { COL_WIDTH, ROW_HEIGHT } from "../constants/planningDefaults";

const DRAG_THRESHOLD_PX = 3;

// Native pointer drag of a planning block: "move" (horizontal = steps,
// vertical = resource row), "resizeEnd" (right handle = the end moves) or
// "resizeStart" (left handle = the start moves, the end stays). Only a
// SELECTED block is draggable: the grid decides, this hook is only the
// engine. Returns a preview {slotId, startStep, steps, rowIndex} while
// dragging (the grid renders the block at the previewed place) and commits
// through `onCommit` on release.
// No dnd-kit: the app-wide DndContext sensor has a 250 ms delay.
export default function useSlotPointerDrag({ rowCount, onCommit }) {
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
      if (d.mode === "resizeEnd") {
        next = {
          slotId: d.slot.id,
          startStep: d.slot.startStep,
          steps: Math.max(1, d.slot.steps + dSteps),
          rowIndex: d.rowIndex,
        };
      } else if (d.mode === "resizeStart") {
        // Left handle: the end (startStep + steps) stays fixed.
        const maxShift = d.slot.steps - 1; // keep at least one step
        const minShift = -d.slot.startStep; // never before step 0
        const shift = Math.min(Math.max(dSteps, minShift), maxShift);
        next = {
          slotId: d.slot.id,
          startStep: d.slot.startStep + shift,
          steps: d.slot.steps - shift,
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

    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    }

    // The browser cancels the pointer (touch turned into a scroll, window lost)
    // WITHOUT firing pointerup: abort, or the listeners and the preview leak.
    function onCancel() {
      cleanup();
      dragRef.current = null;
      setPreview(null);
    }

    function onUp() {
      cleanup();
      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;
      if (!d.moved) {
        setPreview(null);
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
    window.addEventListener("pointercancel", onCancel);
  }

  return { preview, startDrag, isDragging: Boolean(preview) };
}
