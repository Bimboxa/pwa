import { createSlice } from "@reduxjs/toolkit";

import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import getInitScopeId from "Features/init/services/getInitScopeId";
import getInitScopeVisibility from "Features/init/services/getInitScopeVisibility";

// Per-scope, per-device visibility of the annotation templates (the "eye" of
// the template / listing rows). It used to be the persisted `hidden` field of
// db.annotationTemplates, which made the eye a scope-content write (blocked
// on a foreign private scope, tracked as a local change, exported in the
// Krto zip and dropped from the data exports). It is now plain local state:
// `useAnnotationTemplates` derives `template.hidden` from this list, and the
// scopeVisibilityPersistMiddleware saves it to localStorage per scope (with
// the listings eyes and the 2D / 3D base map toggles of the other slices).
// Re-hydrated on every scope selection so ids never leak across scopes.
const initialSaved = getInitScopeVisibility(getInitScopeId());

const scopeVisibilityInitialState = {
  hiddenAnnotationTemplateIds: initialSaved?.hiddenAnnotationTemplateIds ?? [],
  // Eye of the revolution axis rows (SectionRevolutionAxes): hides the axis
  // and everything linked to it (placements, revolved profiles / circles,
  // paints on those surfaces). Same local, per-scope contract.
  hiddenRevolutionAxisIds: initialSaved?.hiddenRevolutionAxisIds ?? [],
  // True when the selected scope had saved 3D base map toggles on this
  // device: the Viewer module then skips its scope-open seeding (images off,
  // every annotated base map's annotations on) and keeps the restored state.
  hasSavedThreedState: Boolean(initialSaved?.threed),
};

const withIds = (current, ids, hidden) => {
  const set = new Set(current);
  ids.forEach((id) => {
    if (!id) return;
    if (hidden) set.add(id);
    else set.delete(id);
  });
  return [...set];
};

export const scopeVisibilitySlice = createSlice({
  name: "scopeVisibility",
  initialState: scopeVisibilityInitialState,
  reducers: {
    setHiddenAnnotationTemplateIds: (state, action) => {
      state.hiddenAnnotationTemplateIds = [
        ...new Set((action.payload ?? []).filter(Boolean)),
      ];
    },
    // Batch: { ids: [templateId], hidden: boolean }.
    setAnnotationTemplatesHidden: (state, action) => {
      const { ids, hidden } = action.payload ?? {};
      if (!ids?.length) return;
      state.hiddenAnnotationTemplateIds = withIds(
        state.hiddenAnnotationTemplateIds,
        ids,
        Boolean(hidden)
      );
    },
    toggleAnnotationTemplateHidden: (state, action) => {
      const id = action.payload;
      if (!id) return;
      const hidden = !state.hiddenAnnotationTemplateIds.includes(id);
      state.hiddenAnnotationTemplateIds = withIds(
        state.hiddenAnnotationTemplateIds,
        [id],
        hidden
      );
    },
    toggleRevolutionAxisHidden: (state, action) => {
      const id = action.payload;
      if (!id) return;
      const hidden = !state.hiddenRevolutionAxisIds.includes(id);
      state.hiddenRevolutionAxisIds = withIds(
        state.hiddenRevolutionAxisIds,
        [id],
        hidden
      );
    },
  },
  extraReducers: (builder) => {
    builder.addCase(setSelectedScopeId, (state, action) => {
      const saved = getInitScopeVisibility(action.payload);
      state.hiddenAnnotationTemplateIds =
        saved?.hiddenAnnotationTemplateIds ?? [];
      state.hiddenRevolutionAxisIds = saved?.hiddenRevolutionAxisIds ?? [];
      state.hasSavedThreedState = Boolean(saved?.threed);
    });
  },
});

export const {
  setHiddenAnnotationTemplateIds,
  setAnnotationTemplatesHidden,
  toggleAnnotationTemplateHidden,
  toggleRevolutionAxisHidden,
} = scopeVisibilitySlice.actions;

export default scopeVisibilitySlice.reducer;
