import { useEffect } from "react";
import { useSelector } from "react-redux";

import useSwitchViewer from "./useSwitchViewer";

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

// "T" toggles the 2D map <-> 3D viewer, like the topBar button. Fires
// upstream only (!enabledDrawingMode) so it never contends with the
// in-draw "T" (arc toggle) or LOCALIZED_REPAIR "T" (T-junction).
export default function useToggleThreedViewerHotkey() {
  const switchViewer = useSwitchViewer();
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  useEffect(() => {
    if (enabledDrawingMode) return undefined;

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key.toLowerCase() !== "t") return;

      switchViewer(selectedViewerKey === "THREED" ? "MAP" : "THREED");
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabledDrawingMode, selectedViewerKey, switchViewer]);
}
