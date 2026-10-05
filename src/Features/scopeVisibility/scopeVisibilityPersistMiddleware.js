import setInitScopeVisibility from "Features/init/services/setInitScopeVisibility";

// Saves the per-scope visibility settings to localStorage whenever one of
// them changes (same pattern as syncedVersionPersistMiddleware). Watched by
// REFERENCE: every slice replaces these values immutably (immer), so a
// changed reference means a changed value. The write that follows a scope
// selection (the slices re-hydrate from storage) is idempotent.
const pick2d = (state) => ({
  hideBaseMapImageInViewer: Boolean(state.viewers?.hideBaseMapImageInViewer),
  hideAnnotationsInViewer: Boolean(state.viewers?.hideAnnotationsInViewer),
  visibleBaseMapIdsIn2d: state.viewers?.visibleBaseMapIdsIn2d ?? [],
  annotationsBaseMapIdsIn2d: state.viewers?.annotationsBaseMapIdsIn2d ?? [],
});

const pick3d = (state) => {
  const t = state.threedEditor ?? {};
  return {
    visibleBaseMapIdsIn3d: t.visibleBaseMapIdsIn3d ?? [],
    hiddenScene3dBaseMapIdsIn3d: t.hiddenScene3dBaseMapIdsIn3d ?? [],
    annotationsModeByBaseMapIdIn3d: t.annotationsModeByBaseMapIdIn3d ?? {},
    hideMainBaseMapImageIn3d: Boolean(t.hideMainBaseMapImageIn3d),
    hideMainBaseMapAnnotationsIn3d: Boolean(t.hideMainBaseMapAnnotationsIn3d),
    mainBaseMapId: state.mapEditor?.selectedBaseMapId ?? null,
  };
};

const changed2d = (prev, next) =>
  prev.viewers?.hideBaseMapImageInViewer !==
    next.viewers?.hideBaseMapImageInViewer ||
  prev.viewers?.hideAnnotationsInViewer !==
    next.viewers?.hideAnnotationsInViewer ||
  prev.viewers?.visibleBaseMapIdsIn2d !== next.viewers?.visibleBaseMapIdsIn2d ||
  prev.viewers?.annotationsBaseMapIdsIn2d !==
    next.viewers?.annotationsBaseMapIdsIn2d;

const changed3d = (prev, next) =>
  prev.threedEditor?.visibleBaseMapIdsIn3d !==
    next.threedEditor?.visibleBaseMapIdsIn3d ||
  prev.threedEditor?.hiddenScene3dBaseMapIdsIn3d !==
    next.threedEditor?.hiddenScene3dBaseMapIdsIn3d ||
  prev.threedEditor?.annotationsModeByBaseMapIdIn3d !==
    next.threedEditor?.annotationsModeByBaseMapIdIn3d ||
  prev.threedEditor?.hideMainBaseMapImageIn3d !==
    next.threedEditor?.hideMainBaseMapImageIn3d ||
  prev.threedEditor?.hideMainBaseMapAnnotationsIn3d !==
    next.threedEditor?.hideMainBaseMapAnnotationsIn3d ||
  prev.mapEditor?.selectedBaseMapId !== next.mapEditor?.selectedBaseMapId;

const scopeVisibilityPersistMiddleware = (store) => (next) => (action) => {
  const prev = store.getState();
  const result = next(action);
  const state = store.getState();
  const scopeId = state.scopes?.selectedScopeId;
  if (!scopeId) return result;

  const patch = {};
  if (prev.layers?.hiddenLayerIds !== state.layers?.hiddenLayerIds) {
    patch.hiddenLayerIds = state.layers?.hiddenLayerIds ?? [];
  }
  if (
    prev.scopeVisibility?.hiddenAnnotationTemplateIds !==
    state.scopeVisibility?.hiddenAnnotationTemplateIds
  ) {
    patch.hiddenAnnotationTemplateIds =
      state.scopeVisibility?.hiddenAnnotationTemplateIds ?? [];
  }
  if (
    prev.scopeVisibility?.hiddenRevolutionAxisIds !==
    state.scopeVisibility?.hiddenRevolutionAxisIds
  ) {
    patch.hiddenRevolutionAxisIds =
      state.scopeVisibility?.hiddenRevolutionAxisIds ?? [];
  }
  if (prev.listings?.hiddenListingsIds !== state.listings?.hiddenListingsIds) {
    patch.hiddenListingsIds = state.listings?.hiddenListingsIds ?? [];
  }
  if (prev.viewers?.baseMapsImageMode !== state.viewers?.baseMapsImageMode) {
    patch.baseMapsImageMode = state.viewers?.baseMapsImageMode ?? null;
  }
  if (changed2d(prev, state)) patch.viewer2d = pick2d(state);
  if (changed3d(prev, state)) patch.threed = pick3d(state);

  if (Object.keys(patch).length > 0) setInitScopeVisibility(scopeId, patch);
  return result;
};

export default scopeVisibilityPersistMiddleware;
