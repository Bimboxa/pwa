import { useState, useRef, useCallback, useEffect } from "react";

// ---------------------------------------------------------------------------
// usePanelResize — corner resize of a floating panel (same mechanics as
// usePanelDrag: document mousemove / mouseup). `size` stays null until the
// user resizes: the panel keeps its CSS default geometry (width + maxHeight).
// From the first drag, the measured rect of `paperRef` is the starting point,
// and the panel gets an explicit width / height. `fitContent` ("auto" button
// of PanelFooter) keeps the current width and sets the height to CSS "auto":
// the panel follows its content (capped by the panel's maxHeight) until the
// next drag. `reset` (double-click on the handle) returns to the defaults.
//
// `anchor`: side the panel is anchored to. "left" (default) → bottom-right
// handle, the width grows with +dx. "right" (a panel positioned with CSS
// `right:`, e.g. PopperImages) → bottom-left handle, the width grows with
// -dx: the panel extends leftwards.
// ---------------------------------------------------------------------------

export default function usePanelResize({
  paperRef,
  minWidth = 240,
  minHeight = 120,
  anchor = "left",
} = {}) {
  const [size, setSize] = useState(null);
  const isResizing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });
  const widthSign = anchor === "right" ? -1 : 1;

  const handleMouseMove = useCallback(
    (e) => {
      if (!isResizing.current) return;
      const dx = (e.clientX - startPos.current.x) * widthSign;
      const dy = e.clientY - startPos.current.y;
      setSize({
        width: Math.max(minWidth, Math.round(startSize.current.width + dx)),
        height: Math.max(minHeight, Math.round(startSize.current.height + dy)),
      });
    },
    [minWidth, minHeight, widthSign]
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
      document.body.style.cursor =
        widthSign < 0 ? "nesw-resize" : "nwse-resize";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [paperRef, handleMouseMove, handleMouseUp, widthSign]
  );

  const fitContent = useCallback(() => {
    const rect = paperRef?.current?.getBoundingClientRect();
    setSize((s) => ({
      width: rect ? Math.round(rect.width) : (s?.width ?? undefined),
      height: "auto",
    }));
  }, [paperRef]);

  const reset = useCallback(() => setSize(null), []);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const isAutoHeight = size?.height === "auto";

  return {
    size,
    isResizing,
    isAutoHeight,
    handleResizeMouseDown,
    fitContent,
    reset,
  };
}
