import { useEffect } from "react";
import { useSelector, useStore } from "react-redux";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Mirrors `state.threedEditor.visibleBaseMapIdsIn3d` to the 3D scene by
// toggling each basemap group's `.visible` flag — no scene reload. A basemap
// shown for the first time is lazily created once, then cached (kept hidden
// when toggled back off) so subsequent toggles are a cheap flag flip.
// The main (selected) basemap is always visible. Mounted once from
// MainThreedEditor, same pattern as useApplyBaseMapOpacityIn3d.
export default function useApplyBaseMapVisibilityIn3d() {
  const visibleIds = useSelector((s) => s.threedEditor.visibleBaseMapIdsIn3d);
  const mainBaseMap = useMainBaseMap();
  const { value: baseMaps = [] } = useBaseMaps();
  const store = useStore();

  const visibleKey = (visibleIds || []).join(",");
  const baseMapsKey = baseMaps.map((b) => b.id).join(",");

  useEffect(() => {
    const editor = getActiveThreedEditor();
    const imagesManager = editor?.sceneManager?.imagesManager;
    if (!imagesManager) return;

    const opacity = store.getState().threedEditor.baseMapOpacityIn3d;
    const mainId = mainBaseMap?.id ?? null;
    const visible = new Set(visibleIds || []);

    baseMaps.forEach((bm) => {
      const shouldShow = bm.id === mainId || visible.has(bm.id);
      if (shouldShow) {
        if (!imagesManager.hasImageObject(bm.id)) {
          editor.ensureBaseMapLoaded(bm, { opacity });
        }
        imagesManager.setBaseMapVisible(bm.id, true);
      } else if (imagesManager.hasImageObject(bm.id)) {
        imagesManager.setBaseMapVisible(bm.id, false);
      }
    });
    editor.renderScene?.();
  }, [visibleKey, mainBaseMap?.id, baseMapsKey]);
}
