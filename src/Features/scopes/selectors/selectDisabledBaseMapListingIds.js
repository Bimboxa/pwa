import { createSelector } from "@reduxjs/toolkit";

// Stable fallback so consumers can safely use the array in memo / effect deps.
const EMPTY = [];

// BASE_MAP listing ids (folders) hidden in the selected scope — the eye of the
// SCOPE module's content panel, stored on the scope record
// (scope.baseMapsSettings.disabledListingIds). Read from the Redux mirror of
// db.scopes (dexieSyncService -> setScopesById): the ~60 mounted base map /
// annotation hooks must not each run a db.scopes live query.
export const selectDisabledBaseMapListingIds = createSelector(
  [(state) => state.scopes.scopesById, (state) => state.scopes.selectedScopeId],
  (scopesById, scopeId) =>
    (scopeId && scopesById?.[scopeId]?.baseMapsSettings?.disabledListingIds) ||
    EMPTY
);

// Same ids as a sorted, joined string: a primitive dep for live queries and
// memos, which changes only when the set of hidden folders changes.
export const selectDisabledBaseMapListingIdsKey = createSelector(
  [selectDisabledBaseMapListingIds],
  (ids) => (ids.length > 0 ? [...ids].sort().join(",") : "")
);

// Whether the selected scope's record is already mirrored in Redux: EMPTY is
// also returned while the row is not loaded yet, so consumers that must not
// act on a not-yet-loaded scope wait on this flag.
export const selectDisabledBaseMapListingIdsSynced = (state) => {
  const scopeId = state.scopes.selectedScopeId;
  return Boolean(scopeId && state.scopes.scopesById?.[scopeId]);
};
