import { createSlice } from "@reduxjs/toolkit";

import { setSelectedScopeId } from "Features/scopes/scopesSlice";

// Phasing (PHASING business-objects listings): the phases are the business
// objects of the listing, an annotation is linked to them through
// db.relsPhaseAnnotation.
//
// ONE notion of "selected phases": they are the phases displayed by the
// editors (the annotations present in none of them are hidden — display
// only, see hooks/usePhaseHiddenAnnotationIdSet) AND the phases a new
// annotation is assigned to (services/requestPhaseAssignOnCreate). Empty =
// everything is displayed, a new annotation gets no phase (present in all).
const phasingSlice = createSlice({
  name: "phasing",
  initialState: {
    // PHASING listing driving the phases strip (null = the first one of the
    // scope, see hooks/usePhasingListing)
    activeListingId: null,
    selectedPhaseIds: [],
    relsPhaseUpdatedAt: null,
    // strip toggle: the annotations that are not new in the displayed phases
    // get a lighter tint in the editors (hooks/usePhaseNewAnnotationIdSet)
    highlightNewAnnotations: false,
  },
  reducers: {
    setActivePhasingListingId: (state, action) => {
      if (state.activeListingId === action.payload) return;
      state.activeListingId = action.payload;
      // the selected phases belong to the previous listing
      state.selectedPhaseIds = [];
    },
    setSelectedPhaseIds: (state, action) => {
      state.selectedPhaseIds = action.payload ?? [];
    },
    // {id, additive}: plain click = that phase only (again: none), additive
    // (Shift click) = add / remove it
    togglePhaseSelection: (state, action) => {
      const { id, additive } = action.payload ?? {};
      if (!id) return;
      const isSelected = state.selectedPhaseIds.includes(id);
      if (additive) {
        state.selectedPhaseIds = isSelected
          ? state.selectedPhaseIds.filter((phaseId) => phaseId !== id)
          : [...state.selectedPhaseIds, id];
        return;
      }
      state.selectedPhaseIds =
        isSelected && state.selectedPhaseIds.length === 1 ? [] : [id];
    },
    setHighlightNewAnnotations: (state, action) => {
      state.highlightNewAnnotations = Boolean(action.payload);
    },
    triggerRelsPhaseAnnotationUpdate: (state) => {
      state.relsPhaseUpdatedAt = Date.now();
    },
  },
  extraReducers: (builder) => {
    builder.addCase(setSelectedScopeId, (state) => {
      state.activeListingId = null;
      state.selectedPhaseIds = [];
    });
  },
});

export const {
  setActivePhasingListingId,
  setSelectedPhaseIds,
  togglePhaseSelection,
  setHighlightNewAnnotations,
  triggerRelsPhaseAnnotationUpdate,
} = phasingSlice.actions;

export default phasingSlice.reducer;
