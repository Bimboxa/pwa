import { useRef, useCallback, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setToolbarDragOffset } from "../mapEditorSlice";

export default function useToolbarDrag() {
  const dispatch = useDispatch();
  const dragOffset = useSelector((s) => s.mapEditor.toolbarDragOffset);

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    dispatch(
      setToolbarDragOffset({
        x: offsetStart.current.x + e.clientX - dragStart.current.x,
        y: offsetStart.current.y + e.clientY - dragStart.current.y,
      })
    );
  }, [dispatch]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const handleDragStart = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      offsetStart.current = { x: dragOffset.x, y: dragOffset.y };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [dragOffset, handleMouseMove, handleMouseUp]
  );

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return { dragOffset, isDragging, handleDragStart };
}
