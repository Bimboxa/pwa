import { useCallback, useEffect, useRef } from "react";

// Drag behaviour for a floating, persisted-position panel.
// Mirrors Features/layout/hooks/usePanelDrag but lifts state to the caller
// (so the position can live in Redux instead of local state).
export default function usePanelDrag({ position, onChange }) {
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  const onChangeRef = useRef(onChange);

  // keep latest onChange without re-binding listeners
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    onChangeRef.current({
      x: startOffset.current.x + dx,
      y: startOffset.current.y + dy,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(
    (e) => {
      // Ignore drags initiated from interactive children (button, link, input)
      if (e.target.closest?.("button, input, a")) return;
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      startOffset.current = { x: position.x, y: position.y };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [position.x, position.y, handleMouseMove, handleMouseUp]
  );

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return { isDragging, handleMouseDown };
}
