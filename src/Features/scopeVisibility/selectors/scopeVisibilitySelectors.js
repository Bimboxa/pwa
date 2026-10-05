import { createSelector } from "@reduxjs/toolkit";

const EMPTY = [];

export const selectHiddenAnnotationTemplateIds = (state) =>
  state.scopeVisibility?.hiddenAnnotationTemplateIds ?? EMPTY;

// Memoized Set: stable while the ids array is (the slice replaces the array
// on every change, never mutates it in place).
export const selectHiddenAnnotationTemplateIdSet = createSelector(
  [selectHiddenAnnotationTemplateIds],
  (ids) => new Set(ids)
);

export const selectHiddenRevolutionAxisIds = (state) =>
  state.scopeVisibility?.hiddenRevolutionAxisIds ?? EMPTY;

export const selectHiddenRevolutionAxisIdSet = createSelector(
  [selectHiddenRevolutionAxisIds],
  (ids) => new Set(ids)
);

export const selectHasSavedThreedVisibility = (state) =>
  Boolean(state.scopeVisibility?.hasSavedThreedState);
