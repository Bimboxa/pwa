import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// BaseMaps module: is the PopperMapListings panel a read-only LEGEND (same
// behavior as in the Viewer module — only what is drawn on the displayed
// base maps, no drawing entry)?
// - 3D editor: always (the module edits its isForBaseMaps drawings from the
//   2D editor only);
// - 2D editor: unless the "drawing tools" switch of the transforms panel
//   (popperMapListings.showInBaseMapsViewer) turns the popper into the
//   "Dessins sur fond de plan" drawing panel.
export default function selectIsBaseMapsLegendPopper(state) {
  if (state.viewers.selectedViewerKey !== "BASE_MAPS") return false;
  return (
    !state.popperMapListings.showInBaseMapsViewer ||
    isThreedFamilyViewerKey(selectEffectiveViewerKey(state))
  );
}
