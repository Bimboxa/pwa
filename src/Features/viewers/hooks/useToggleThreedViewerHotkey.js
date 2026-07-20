import { useEffect } from "react";
import { useSelector } from "react-redux";

import useToggleModuleEditor from "./useToggleModuleEditor";
import useTogglePovViewerMode from "Features/pov/hooks/useTogglePovViewerMode";

const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
};

// "T" toggles the 2D/3D editor displayed inside the current multi-editor
// module (Dessin, POV) — the left-band selection does not move. Inert in
// single-editor modules (THREED recap, MESHES, ...). Fires upstream only
// (!enabledDrawingMode) so it never contends with the in-draw "T" (arc
// toggle) or LOCALIZED_REPAIR "T" (T-junction).
export default function useToggleThreedViewerHotkey() {
  const toggleModuleEditor = useToggleModuleEditor();
  const togglePovViewerMode = useTogglePovViewerMode();
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const walkModeActive = useSelector((s) => s.threedEditor.walkMode.active);

  useEffect(() => {
    if (enabledDrawingMode) return undefined;
    // Walk mode owns the keyboard (arrows, Space, W to exit).
    if (walkModeActive) return undefined;

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key.toLowerCase() !== "t") return;

      if (selectedViewerKey === "POINT_OF_VIEW") {
        // POV keeps its own editor mode until it migrates to
        // editorKeyByModule (see issue #296).
        togglePovViewerMode();
      } else if (selectedViewerKey === "MAP" || selectedViewerKey === "ZONES") {
        toggleModuleEditor();
      } else {
        // Single-editor modules: no 2D<->3D toggle.
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    enabledDrawingMode,
    walkModeActive,
    selectedViewerKey,
    toggleModuleEditor,
    togglePovViewerMode,
  ]);
}
