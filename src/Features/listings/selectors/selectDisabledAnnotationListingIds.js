import { createSelector } from "@reduxjs/toolkit";

// Stable fallback so consumers can safely use the array in memo / effect deps.
const EMPTY = [];

// Annotation listing ids disabled in the selected scope — the eye of their
// row in the SCOPE module « Contenu » tab (listings.disabledAnnotationListingIds,
// Redux only). A disabled listing is left out of every other module.
export const selectDisabledAnnotationListingIds = (state) =>
  state.listings.disabledAnnotationListingIds || EMPTY;

// Same ids as a sorted, joined string: a primitive dep for live queries and
// memos, which changes only when the set of disabled listings changes.
export const selectDisabledAnnotationListingIdsKey = createSelector(
  [selectDisabledAnnotationListingIds],
  (ids) => (ids.length > 0 ? [...ids].sort().join(",") : "")
);
