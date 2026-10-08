import { useState, useRef, useCallback, useEffect } from "react";

// ---------------------------------------------------------------------------
// usePanelResize — bottom-right corner resize of a floating panel (same
// mechanics as usePanelDrag: document mousemove / mouseup). `size` stays null
// until the user resizes: the panel keeps its CSS default geometry (width +
// maxHeight). From the first drag, the measured rect of `paperRef` is the
// starting point, and the panel gets an explicit width / height. `reset`
// (double-click on the handle) returns to the defaults.
// ---------------------------------------------------------------------------

export default function usePanelResize({
  paperRef,
  minWidth = 240,
  minHeight = 120,
} = {}) {
  const [size, setSize] = useState(null);
  const isResizing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });

  const handleMouseMove = useCallback(
    (e) => {
      if (!isResizing.current) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      setSize({
        width: Math.max(minWidth, Math.round(startSize.current.width + dx)),
        height: Math.max(minHeight, Math.round(startSize.current.height + dy)),
      });
    },
    [minWidth, minHeight]
  );

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = "";
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const handleResizeMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = paperRef?.current?.getBoundingClientRect();
      if (!rect) return;
      isResizing.current = true;
      startPos.current = { x: e.clientX, y: e.clientY };
      startSize.current = { width: rect.width, height: rect.height };
      document.body.style.cursor = "nwse-resize";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [paperRef, handleMouseMove, handleMouseUp]
  );

  const reset = useCallback(() => setSize(null), []);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return { size, isResizing, handleResizeMouseDown, reset };
}
