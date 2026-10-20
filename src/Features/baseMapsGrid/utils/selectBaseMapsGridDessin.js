import { selectBaseMapsGridMounted } from "../baseMapsGridSlice";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// The Dessin module ("MAP") gives the base maps grid a "direct" display, in
// 2D (LayerBaseMapsGrid) and in 3D (BaseMapsGridManager) alike: every base
// map of the scope lies on the table (all folders, no listing tabs) with
// EVERY annotation drawn on it — the Dessin display filters (listing eyes,
// template eyes, solos, viewer eyes, 3D image eyes / annotation modes) do
// not narrow the table. Only the folders hidden in the scope and the
// annotation listings disabled in the scope stay out (useBaseMaps /
// useAnnotationsV2 apply them for every caller). The editor chrome (docked
// Dessin panel, listings popper, commands toolbar, pre-draw toolbar) is
// hidden while the grid covers the editor.
// Single source of truth for both grids — the SCOPE module has its own
// semantics (selectBaseMapsGridPinned).
export default function selectBaseMapsGridDessin(state) {
  return state.viewers.selectedViewerKey === "MAP";
}

// Dessin module AND its grid displayed over the displayed editor: 3D grid
// mode active, or the 2D grid layer mounted (from the fade-in on — the
// chrome leaves in the same commit as the opaque layer covers the editor).
export function selectBaseMapsGridDessinOpen(state) {
  if (!selectBaseMapsGridDessin(state)) return false;
  return isThreedFamilyViewerKey(selectEffectiveViewerKey(state))
    ? Boolean(state.threedEditor.baseMapsGridMode.active)
    : selectBaseMapsGridMounted(state);
}
