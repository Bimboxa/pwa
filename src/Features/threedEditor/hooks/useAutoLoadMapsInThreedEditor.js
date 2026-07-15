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

  // Repair effect: the first load above can run with an incomplete baseMap —
  // no image url yet (db.files row committed after the baseMaps row during a
  // Krto import) or no scale yet (the creation dialog stores meterByPx null,
  // producing a 0-sized invisible plane). When the liveQuery re-emits the
  // same baseMap with its blob url resolved and/or a valid scale, repair the
  // existing group in place — ensureBaseMapLoaded reattaches a failed
  // texture, applyBaseMapPlacement resizes the plane — without rebuilding
  // the scene (annotations attached to the group are untouched). Keyed on
  // url PRESENCE (booleans, not the blob-url strings, to avoid re-firing on
  // every new object URL) + the meterByPx values (change rarely).
  const repairKey =
    `${mainBaseMap?.image?.imageUrlClient ? 1 : 0}:${mainBaseMap?.meterByPx ?? ""}` +
    "|" +
    baseMaps
      .map(
        (b) =>
          `${b.id}:${b?.image?.imageUrlClient ? 1 : 0}:${b?.meterByPx ?? ""}`
      )
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
    [mainBaseMap, ...extras].forEach((bm) => {
      threedEditor.ensureBaseMapLoaded(bm, { opacity });
      threedEditor.applyBaseMapPlacement(bm);
    });
  }, [rendererIsReady, mainBaseMap?.id, repairKey]);
}
