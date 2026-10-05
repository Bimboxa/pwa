// Per-scope, per-device visibility settings (annotation templates eyes,
// listings eyes, base map image / annotations toggles of the 2D and 3D
// editors). Stored in localStorage only: never in Dexie, never exported in a
// Krto zip, never subject to the private-scope read-only guard. See
// Features/scopeVisibility.
import { isBaseMapsImageMode } from "Features/baseMaps/constants/baseMapsImageMode";

const STORAGE_KEY_PREFIX = "scopeVisibility:";

export function getScopeVisibilityStorageKey(scopeId) {
  return `${STORAGE_KEY_PREFIX}${scopeId}`;
}

const toIdArray = (value) =>
  Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];

const toViewer2d = (value) =>
  value && typeof value === "object"
    ? {
        hideBaseMapImageInViewer: Boolean(value.hideBaseMapImageInViewer),
        hideAnnotationsInViewer: Boolean(value.hideAnnotationsInViewer),
        visibleBaseMapIdsIn2d: toIdArray(value.visibleBaseMapIdsIn2d),
        annotationsBaseMapIdsIn2d: toIdArray(value.annotationsBaseMapIdsIn2d),
      }
    : null;

const toThreed = (value) => {
  if (!value || typeof value !== "object") return null;
  const modes = value.annotationsModeByBaseMapIdIn3d;
  return {
    visibleBaseMapIdsIn3d: toIdArray(value.visibleBaseMapIdsIn3d),
    hiddenScene3dBaseMapIdsIn3d: toIdArray(value.hiddenScene3dBaseMapIdsIn3d),
    annotationsModeByBaseMapIdIn3d:
      modes && typeof modes === "object" && !Array.isArray(modes)
        ? { ...modes }
        : {},
    hideMainBaseMapImageIn3d: Boolean(value.hideMainBaseMapImageIn3d),
    hideMainBaseMapAnnotationsIn3d: Boolean(
      value.hideMainBaseMapAnnotationsIn3d
    ),
    mainBaseMapId:
      typeof value.mainBaseMapId === "string" ? value.mainBaseMapId : null,
  };
};

// Returns the saved settings of a scope (normalized), or null when nothing
// was saved for it on this device.
export default function getInitScopeVisibility(scopeId) {
  if (!scopeId) return null;
  try {
    const raw = localStorage.getItem(getScopeVisibilityStorageKey(scopeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      hiddenAnnotationTemplateIds: toIdArray(
        parsed.hiddenAnnotationTemplateIds
      ),
      hiddenRevolutionAxisIds: toIdArray(parsed.hiddenRevolutionAxisIds),
      hiddenListingsIds: toIdArray(parsed.hiddenListingsIds),
      hiddenLayerIds: toIdArray(parsed.hiddenLayerIds),
      viewer2d: toViewer2d(parsed.viewer2d),
      threed: toThreed(parsed.threed),
      // global base map images display (null = never saved, default applies)
      baseMapsImageMode: isBaseMapsImageMode(parsed.baseMapsImageMode)
        ? parsed.baseMapsImageMode
        : null,
    };
  } catch {
    return null;
  }
}
