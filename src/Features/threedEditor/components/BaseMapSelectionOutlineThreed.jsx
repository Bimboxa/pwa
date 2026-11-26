import { useEffect } from "react";

import { useSelector } from "react-redux";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Mirrors the selected base map (the BASE_MAP item of the selection, the one
// the properties panel shows) to the 3D scene, which outlines it
// (ImagesManager.setSelectedBaseMapId). Render-null child of MainThreedEditor
// so a selection change never re-renders the editor itself (same reason as
// ThreedSelectionDimmer).
export default function BaseMapSelectionOutlineThreed({ enabled }) {
  // data

  const selectedBaseMapId = useSelector((s) => {
    const item = s.selection.selectedItems?.[0];
    return item?.type === "BASE_MAP" ? item.id : null;
  });

  // effects

  useEffect(() => {
    if (!enabled) return;
    const imagesManager = getActiveThreedEditor()?.sceneManager?.imagesManager;
    if (!imagesManager?.setSelectedBaseMapId) return;
    imagesManager.setSelectedBaseMapId(selectedBaseMapId);
    return () => imagesManager.setSelectedBaseMapId(null);
  }, [enabled, selectedBaseMapId]);

  // render

  return null;
}
