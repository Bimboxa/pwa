import { useEffect } from "react";
import { useStore } from "react-redux";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

export default function useAutoLoadMapsInThreedEditor({
  threedEditor,
  rendererIsReady,
}) {
  const mainBaseMap = useMainBaseMap();
  const { value: baseMaps = [] } = useBaseMaps();
  const store = useStore();

  const baseMapsKey = baseMaps.map((b) => b.id).join(",");

  // Full (re)load only on main / project change. Visibility toggles are
  // applied live by useApplyBaseMapVisibilityIn3d (just flips group.visible),
  // so `visibleBaseMapIdsIn3d` is read from the store here instead of being an
  // effect dependency — toggling no longer rebuilds the scene. The currently
  // visible extras are still included so they survive a main-base-map change,
  // which legitimately rebuilds the scene (annotations re-attach).
  useEffect(() => {
    if (!threedEditor?.loadMaps || !mainBaseMap?.id) return;
    const state = store.getState().threedEditor;
    const opacity = state.baseMapOpacityIn3d;
    const visibleIds = state.visibleBaseMapIdsIn3d || [];
    const extras = baseMaps.filter(
      (b) =>
        b.id !== mainBaseMap.id &&
        visibleIds.includes(b.id) &&
        b?.image?.imageUrlClient
    );
    threedEditor.loadMaps([mainBaseMap, ...extras], { opacity });
  }, [rendererIsReady, mainBaseMap?.id, baseMapsKey]);
}
