import { useRef } from "react";

// Pixels the pointer must travel before a press becomes a drag (same
// threshold as the viewport pan): below, the press is a click.
const DRAG_THRESHOLD_PX = 3;

// Drag of a sheet on the table. The sheet group follows the pointer through
// an imperative transform (no React render during the gesture); the position
// is committed once, on pointer up.
//
// getZoom: () => grid camera k (screen px per paper pt).
export default function useSheetDrag({
  sheet,
  groupRef,
  getZoom,
  disabled,
  onClick,
  onCommit,
}) {
  const dragRef = useRef(null);

  function handlePointerDown(e) {
    if (disabled || e.button !== 0) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: sheet.x,
      startY: sheet.y,
      position: null,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (
      !drag.position &&
      Math.abs(dx) <= DRAG_THRESHOLD_PX &&
      Math.abs(dy) <= DRAG_THRESHOLD_PX
    ) {
      return;
    }

    const k = getZoom?.() || 1;
    drag.position = { x: drag.startX + dx / k, y: drag.startY + dy / k };
    groupRef.current?.setAttribute(
      "transform",
      `translate(${drag.position.x}, ${drag.position.y})`
    );
  }

  function handlePointerUp(e) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    if (drag.position) onCommit?.(drag.position);
    else onClick?.(e);
  }

  function handlePointerCancel(e) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    groupRef.current?.setAttribute(
      "transform",
      `translate(${drag.startX}, ${drag.startY})`
    );
  }

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
  };
}
