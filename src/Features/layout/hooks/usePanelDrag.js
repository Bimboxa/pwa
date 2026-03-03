import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Hook that provides drag behavior for floating panels.
 * Extracted from PopperBox drag logic.
 *
 * @returns {{ position: { x: number, y: number }, isDragging: React.MutableRefObject<boolean>, handleMouseDown: (e: MouseEvent) => void }}
 */
export default function usePanelDrag() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    setPosition({
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
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      startOffset.current = { x: position.x, y: position.y };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [position, handleMouseMove, handleMouseUp]
  );

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return { position, isDragging, handleMouseDown };
}
