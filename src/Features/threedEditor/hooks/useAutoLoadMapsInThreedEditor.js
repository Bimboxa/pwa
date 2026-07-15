import { useEffect } from "react";
import { useStore } from "react-redux";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import getBaseMapOpacityIn3d from "Features/threedEditor/utils/getBaseMapOpacityIn3d";

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
    const opacityByBaseMapId = state.opacityByBaseMapIdIn3d;
    const visibleIds = state.visibleBaseMapIdsIn3d || [];
    const extras = baseMaps.filter(
      (b) =>
        b.id !== mainBaseMap.id &&
        visibleIds.includes(b.id) &&
        b?.image?.imageUrlClient
    );
    threedEditor.loadMaps([mainBaseMap, ...extras], {
      opacity,
      opacityByBaseMapId,
    });
  }, [rendererIsReady, mainBaseMap?.id, baseMapsKey]);

  // Repair effect: the first load above can run with an incomplete baseMap —
  // no image url yet (db.files row committed after the baseMaps row during a
  // Krto import) or no scale yet (the creation dialog stores meterByPx null,
  // producing a 0-sized invisible plane) — and the displayed image can change
  // later (active version switch, version transform edit). When the liveQuery
  // re-emits the baseMap, repair the existing group in place —
  // ensureBaseMapLoaded rebuilds the mesh when the image/version changed,
  // applyBaseMapPlacement resizes the plane on a scale change — without
  // rebuilding the scene (annotations attached to the group are untouched).
  // Keyed on the blob url STRING (stable per version thanks to the
  // baseMapsCache in BaseMap.createFromRecord; it changes exactly when the
  // active version or its file changes) + the version transform + meterByPx.
  const versionKeyOf = (b) => {
    const t = b?.getActiveVersionTransform?.() || {};
    return [
      b?.image?.imageUrlClient ?? "",
      `${t.x ?? 0},${t.y ?? 0},${t.rotation ?? 0},${t.scale ?? 1}`,
      b?.meterByPx ?? "",
    ].join(":");
  };
  const repairKey =
    versionKeyOf(mainBaseMap) +
    "|" +
    baseMaps.map((b) => `${b.id}:${versionKeyOf(b)}`).join(",");

  useEffect(() => {
    if (!threedEditor?.ensureBaseMapLoaded || !rendererIsReady) return;
    if (!mainBaseMap?.id) return;
    const state = store.getState().threedEditor;
    const visibleIds = state.visibleBaseMapIdsIn3d || [];
    const extras = baseMaps.filter(
      (b) =>
        b.id !== mainBaseMap.id &&
        visibleIds.includes(b.id) &&
        b?.image?.imageUrlClient
    );
    [mainBaseMap, ...extras].forEach((bm) => {
      threedEditor.ensureBaseMapLoaded(bm, {
        opacity: getBaseMapOpacityIn3d(state, bm.id),
      });
      threedEditor.applyBaseMapPlacement(bm);
    });
  }, [rendererIsReady, mainBaseMap?.id, repairKey]);
}
