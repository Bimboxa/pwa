import { BASE_MAPS_GRID_PHASE } from "../constants/baseMapsGridConstants";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// The SCOPE module ("Dossier") displays the shared 2D / 3D editors and lands
// on their base maps grid mode (2D LayerBaseMapsGrid, 3D
// BaseMapsGridManager): the grid opens when the module is entered and after
// a scope change (`baseMapsGrid.scopeGridWanted`, re-opened by the keepers
// while wanted), and can be left like anywhere else — double-click on a
// sheet (opens that base map in the editor), G / Escape / close button /
// nav sprite — then re-opened with G / the grid button.
// While the grid is displayed, the module gives it its own semantics: the
// sheets follow the content selection of the scope panel (no listing tabs),
// a click selects a sheet (never the main base map), the eye / badge of the
// "Fonds de plan" rows toggle the image / annotations of one sheet.
// Single source of truth for both grids.
export default function selectBaseMapsGridPinned(state) {
  return state.viewers.selectedViewerKey === "SCOPE";
}

// SCOPE module AND its grid displayed (2D phase not closed, or 3D grid mode
// active, for the displayed editor): the grid-specific semantics above.
export function selectBaseMapsGridScopeOpen(state) {
  if (!selectBaseMapsGridPinned(state)) return false;
  return isThreedFamilyViewerKey(selectEffectiveViewerKey(state))
    ? Boolean(state.threedEditor.baseMapsGridMode.active)
    : state.baseMapsGrid.phase !== BASE_MAPS_GRID_PHASE.CLOSED;
}
