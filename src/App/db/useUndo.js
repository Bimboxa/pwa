import { useState, useCallback, useEffect } from "react";
import { undo, redo, canUndo, canRedo } from "./undoManager";

export default function useUndo() {
  const [, forceRender] = useState(0);

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
