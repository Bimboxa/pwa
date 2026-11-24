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
    // strip toggle: a click on a step toggles that single step instead of
    // moving a bound of the period
    stepEditMode: false,
    relsPhaseUpdatedAt: null,
    // period of a new annotation drawn while ONE phase is selected: "FROM" =
    // that phase and the following ones, "ONLY" = that phase only (see
    // utils/getNewAnnotationPhaseIndexes)
    newAnnotationPeriodMode: "FROM",
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
    // (Ctrl / Shift click) = add / remove it
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
    setPhaseStepEditMode: (state, action) => {
      state.stepEditMode = Boolean(action.payload);
    },
    setNewAnnotationPeriodMode: (state, action) => {
      state.newAnnotationPeriodMode =
        action.payload === "ONLY" ? "ONLY" : "FROM";
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
  setPhaseStepEditMode,
  setNewAnnotationPeriodMode,
  triggerRelsPhaseAnnotationUpdate,
} = phasingSlice.actions;

export default phasingSlice.reducer;
