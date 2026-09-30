import setInitScopeVisibility from "Features/init/services/setInitScopeVisibility";

// Saves the per-scope visibility settings to localStorage whenever one of
// them changes (same pattern as syncedVersionPersistMiddleware). Watched by
// REFERENCE: every slice replaces these values immutably (immer), so a
// changed reference means a changed value. The write that follows a scope
// selection (the slices re-hydrate from storage) is idempotent.
const pick2d = (state) => ({
  hideBaseMapImageInViewer: Boolean(state.viewers?.hideBaseMapImageInViewer),
  hideAnnotationsInViewer: Boolean(state.viewers?.hideAnnotationsInViewer),
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
    next.viewers?.hideAnnotationsInViewer;

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
  if (
    prev.scopeVisibility?.hiddenAnnotationTemplateIds !==
    state.scopeVisibility?.hiddenAnnotationTemplateIds
  ) {
    patch.hiddenAnnotationTemplateIds =
      state.scopeVisibility?.hiddenAnnotationTemplateIds ?? [];
  }
  if (prev.listings?.hiddenListingsIds !== state.listings?.hiddenListingsIds) {
    patch.hiddenListingsIds = state.listings?.hiddenListingsIds ?? [];
  }
  if (changed2d(prev, state)) patch.viewer2d = pick2d(state);
  if (changed3d(prev, state)) patch.threed = pick3d(state);

  if (Object.keys(patch).length > 0) setInitScopeVisibility(scopeId, patch);
  return result;
};

export default scopeVisibilityPersistMiddleware;
