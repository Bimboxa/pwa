import { useState, useCallback, useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import { undo, redo, canUndo, canRedo } from "./undoManager";

export default function useUndo() {
  const [, forceRender] = useState(0);

  // While a drawing tool is active, CTRL-Z belongs to the map editor: it pops
  // the last placed point (InteractionLayer keydown handler) and must never
  // revert a committed db write. Kept in a ref so the listener stays bound once.
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const enabledDrawingModeRef = useRef(enabledDrawingMode);
  useEffect(() => {
    enabledDrawingModeRef.current = enabledDrawingMode;
  }, [enabledDrawingMode]);

  const handleUndo = useCallback(async () => {
    await undo();
    forceRender((n) => n + 1);
  }, []);

  const handleRedo = useCallback(async () => {
    await redo();
    forceRender((n) => n + 1);
  }, []);

  // Keyboard shortcuts: CTRL-Z / CTRL-SHIFT-Z
  useEffect(() => {
    function onKeyDown(e) {
      // Let text fields keep their native undo/redo.
      if (
        ["INPUT", "TEXTAREA"].includes(e.target?.tagName) ||
        e.target?.isContentEditable
      ) {
        return;
      }
      // Drawing in progress → InteractionLayer handles CTRL-Z (remove last point).
      if (enabledDrawingModeRef.current) return;

      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (isMeta && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo]);

  return {
    undo: handleUndo,
    redo: handleRedo,
    canUndo: canUndo(),
    canRedo: canRedo(),
  };
}
