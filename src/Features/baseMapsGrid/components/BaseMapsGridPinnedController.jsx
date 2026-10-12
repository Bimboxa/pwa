import { useEffect, useRef } from "react";
import { useSelector, useStore } from "react-redux";

import { selectBaseMapsGridOpen } from "../baseMapsGridSlice";
import selectBaseMapsGridPinned from "../utils/selectBaseMapsGridPinned";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useOpenBaseMapsGrid from "../hooks/useOpenBaseMapsGrid";

import { getActiveMapEditor } from "Features/mapEditor/services/mapEditorRegistry";

// Renders nothing: opens the 2D base maps grid over the shared "MAP" editor
// in the SCOPE module while the grid is WANTED (baseMapsGrid.scopeGridWanted:
// from the module entry / a scope change until the user leaves the grid).
// Every reducer that closes the grid (module / editor / scope / project
// change...) leaves it CLOSED — this effect re-opens it while wanted; a grid
// left by the user (double-click on a sheet, G, Escape, close button) is
// not wanted anymore and stays closed until G / the grid button.
// Mounted by MainMapEditorV3 while this instance is the displayed editor.
export default function BaseMapsGridPinnedController({
  imageModeActive,
  showBgImage,
}) {
  const store = useStore();

  // data

  const pinned = useSelector(selectBaseMapsGridPinned);
  const wanted = useSelector((s) => s.baseMapsGrid.scopeGridWanted);
  const isOpen = useSelector(selectBaseMapsGridOpen);
  const effectiveKey = useSelector(selectEffectiveViewerKey);
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const { value: baseMaps } = useBaseMaps();
  const mainBaseMap = useMainBaseMap();
  const openGrid = useOpenBaseMapsGrid();

  // refs

  // Editor family displayed before the current one: re-opened right after a
  // 3D -> 2D toggle, the grid keeps the synced editor camera (the 3D table
  // was already in sight); otherwise (module entry, scope change) it lands
  // on the whole table, whichever base map is the main one — if any.
  const previousKeyRef = useRef(effectiveKey);
  const cameFromThreedRef = useRef(false);
  if (previousKeyRef.current !== effectiveKey) {
    cameFromThreedRef.current = isThreedFamilyViewerKey(previousKeyRef.current);
    previousKeyRef.current = effectiveKey;
  }

  // helpers

  // The table is laid for the main base map's listing: wait for it (and for
  // the base maps) rather than opening on the first listing.
  const dataReady =
    baseMaps !== undefined && (!mainBaseMapId || Boolean(mainBaseMap));

  // effect

  useEffect(() => {
    if (!pinned || !wanted || isOpen || effectiveKey !== "MAP") return;
    if (imageModeActive || showBgImage || !dataReady) return;
    if (store.getState().baseMapsGrid.phase !== "CLOSED") return;
    // A 0-sized viewport (editor not laid out yet) cannot frame anything.
    const viewport = getActiveMapEditor()?.getViewportSize?.();
    if (!viewport?.width || !viewport?.height) return;
    // No zoom-out of the editor: the table takes over on the current camera
    // (the main sheet stays in place while the others fade in) and flies to
    // the whole table.
    openGrid({ zoom: false, fitAll: !cameFromThreedRef.current });
    cameFromThreedRef.current = false;
  }, [
    pinned,
    wanted,
    isOpen,
    effectiveKey,
    imageModeActive,
    showBgImage,
    dataReady,
    openGrid,
    store,
  ]);

  return null;
}
