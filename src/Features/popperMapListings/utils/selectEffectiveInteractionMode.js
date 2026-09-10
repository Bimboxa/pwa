import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";

// Effective interaction mode of the PopperMapListings panel (and its rows):
// the raw popperMapListings.interactionMode overridden by the module / display
// contexts that force a read-only or edit-only panel. Derived only — nothing
// is dispatched into the slice, so the map itself stays in its own mode.
//
// - "SELECT" (read-only legend): "Maillage" toggle, 3D family viewers, the
//   shared ?mode=viewer lock, the ZONES module (drawing goes through the
//   dedicated "Nouvelle zone" section).
// - "EDIT": business-objects module WITHOUT an active object — template rows
//   edit the template instead of drawing (a new annotation could not be
//   attached to any object); the cut / opening tools stay available.
// - otherwise the raw mode (null = "no mode", draws like DRAW).
export default function selectEffectiveInteractionMode(state) {
  const viewerKey = state.viewers.selectedViewerKey;
  if (
    state.annotations.showMeshCells ||
    isThreedFamilyViewerKey(viewerKey) ||
    state.urlParams.viewerMode ||
    viewerKey === "ZONES"
  )
    return "SELECT";
  if (
    isBusinessObjectsModuleKey(viewerKey) &&
    !state.businessObjects?.activeBusinessObjectId
  )
    return "EDIT";
  return state.popperMapListings.interactionMode;
}
