import { createSelector, createSlice } from "@reduxjs/toolkit";

// Registry of what the user hid with « Masquer l'annotation » (commands
// toolbar): whole annotations and single faces of mesh annotations. Session
// only (never persisted), display only: the 2D editor and the 3D scene drop
// the hidden items — quantities, listings and exports never read it.
//
// Not to be confused with InteractionContext's `hiddenAnnotationIds` (the
// annotations hidden while they are dragged / edited in the 2D editor).
const hiddenAnnotationsSlice = createSlice({
  name: "hiddenAnnotations",
  initialState: {
    // ids of the annotations hidden as a whole
    annotationIds: [],
    // { [annotationId]: [{ key, vertices }] } — hidden faces of a mesh
    // annotation, as geometric signatures (see mesh3dFaceSignature: face
    // indices are renumbered by every mesh write)
    facesByAnnotationId: {},
    // « Afficher »: the registry is kept, nothing is filtered
    showHidden: false,
  },
  reducers: {
    hideAnnotations: (state, action) => {
      const ids = (action.payload ?? []).filter(
        (id) => id && !state.annotationIds.includes(id)
      );
      if (ids.length) state.annotationIds.push(...ids);
      // an annotation hidden as a whole no longer needs its face entries
      for (const id of action.payload ?? []) {
        delete state.facesByAnnotationId[id];
      }
      // hiding while the hidden items are shown must make the item disappear
      state.showHidden = false;
    },
    unhideAnnotations: (state, action) => {
      const ids = new Set(action.payload ?? []);
      if (!ids.size) return;
      state.annotationIds = state.annotationIds.filter((id) => !ids.has(id));
    },
    hideMesh3dFaces: (state, action) => {
      const { annotationId, signatures } = action.payload ?? {};
      if (!annotationId || !signatures?.length) return;
      const current = state.facesByAnnotationId[annotationId] ?? [];
      const keys = new Set(current.map((signature) => signature.key));
      const added = signatures.filter(
        (signature) => signature?.key && !keys.has(signature.key)
      );
      if (added.length) {
        state.facesByAnnotationId[annotationId] = [...current, ...added];
      }
      state.showHidden = false;
    },
    unhideMesh3dFace: (state, action) => {
      const { annotationId, key } = action.payload ?? {};
      const current = state.facesByAnnotationId[annotationId];
      if (!current) return;
      const next = current.filter((signature) => signature.key !== key);
      if (next.length) state.facesByAnnotationId[annotationId] = next;
      else delete state.facesByAnnotationId[annotationId];
    },
    setShowHidden: (state, action) => {
      state.showHidden = Boolean(action.payload);
    },
    clearHiddenAnnotations: (state) => {
      state.annotationIds = [];
      state.facesByAnnotationId = {};
      state.showHidden = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase("scopes/setSelectedScopeId", (state) => {
      state.annotationIds = [];
      state.facesByAnnotationId = {};
      state.showHidden = false;
    });
  },
});

export const {
  hideAnnotations,
  unhideAnnotations,
  hideMesh3dFaces,
  unhideMesh3dFace,
  setShowHidden,
  clearHiddenAnnotations,
} = hiddenAnnotationsSlice.actions;

// Selectors

const selectAnnotationIds = (s) => s.hiddenAnnotations.annotationIds;
const selectFacesByAnnotationId = (s) =>
  s.hiddenAnnotations.facesByAnnotationId;
const selectShowHidden = (s) => s.hiddenAnnotations.showHidden;

// Set of the annotation ids to drop from the display — null when there is
// nothing to filter (empty registry, or « Afficher » is on).
export const selectUserHiddenAnnotationIdSet = createSelector(
  [selectAnnotationIds, selectShowHidden],
  (ids, showHidden) => (showHidden || !ids.length ? null : new Set(ids))
);

// { [annotationId]: signatures } of the faces to hide — null when there is
// nothing to filter.
export const selectUserHiddenFacesByAnnotationId = createSelector(
  [selectFacesByAnnotationId, selectShowHidden],
  (facesByAnnotationId, showHidden) =>
    showHidden || Object.keys(facesByAnnotationId).length === 0
      ? null
      : facesByAnnotationId
);

// Number of entries of the registry (annotations + faces), shown or not.
export const selectHiddenRegistryCount = createSelector(
  [selectAnnotationIds, selectFacesByAnnotationId],
  (ids, facesByAnnotationId) =>
    ids.length +
    Object.values(facesByAnnotationId).reduce(
      (sum, signatures) => sum + signatures.length,
      0
    )
);

export default hiddenAnnotationsSlice.reducer;
