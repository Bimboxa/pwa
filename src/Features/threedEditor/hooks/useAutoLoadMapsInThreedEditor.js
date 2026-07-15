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

  // Repair effect: right after a Krto import, the baseMap record can be read
  // before its db.files row exists, so the first load above runs with no
  // image url and the plane never shows (until refresh). When the liveQuery
  // re-emits the same baseMap with its blob url resolved, re-ensure the
  // texture in place — ensureBaseMapLoaded repairs the existing group without
  // rebuilding the scene (annotations attached to it are untouched). Keyed on
  // url PRESENCE (booleans), not the blob-url strings, to avoid re-firing on
  // every new object URL.
  const urlReadyKey =
    (mainBaseMap?.image?.imageUrlClient ? "1" : "0") +
    "|" +
    baseMaps
      .map((b) => `${b.id}:${b?.image?.imageUrlClient ? 1 : 0}`)
      .join(",");

  useEffect(() => {
    if (!threedEditor?.ensureBaseMapLoaded || !rendererIsReady) return;
    if (!mainBaseMap?.id) return;
    const state = store.getState().threedEditor;
    const opacity = state.baseMapOpacityIn3d;
    const visibleIds = state.visibleBaseMapIdsIn3d || [];
    const extras = baseMaps.filter(
      (b) =>
        b.id !== mainBaseMap.id &&
        visibleIds.includes(b.id) &&
        b?.image?.imageUrlClient
    );
    [mainBaseMap, ...extras].forEach((bm) =>
      threedEditor.ensureBaseMapLoaded(bm, { opacity })
    );
  }, [rendererIsReady, mainBaseMap?.id, urlReadyKey]);
}
