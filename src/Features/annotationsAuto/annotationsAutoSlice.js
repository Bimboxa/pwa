import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  selectedSourceListingId: null,
  selectedTargetListingId: null,
  selectedProcedureKey: null,
  pendingResult: null,
  showConfirmDialog: false,
  height: null,
  checkedTemplateIds: null,
  returnTechnique: true,
};

export const annotationsAutoSlice = createSlice({
  name: "annotationsAuto",
  initialState,
  reducers: {
    setSelectedSourceListingId: (state, action) => {
      state.selectedSourceListingId = action.payload;
    },
    setSelectedTargetListingId: (state, action) => {
      state.selectedTargetListingId = action.payload;
    },
    setSelectedProcedureKey: (state, action) => {
      state.selectedProcedureKey = action.payload;
    },
    setPendingResult: (state, action) => {
      state.pendingResult = action.payload;
    },
    setShowConfirmDialog: (state, action) => {
      state.showConfirmDialog = action.payload;
    },
    setHeight: (state, action) => {
      state.height = action.payload;
    },
    setCheckedTemplateIds: (state, action) => {
      state.checkedTemplateIds = action.payload;
    },
    setReturnTechnique: (state, action) => {
      state.returnTechnique = action.payload;
    },
    reset: () => initialState,
  },
});

export const {
  setSelectedSourceListingId,
  setSelectedTargetListingId,
  setSelectedProcedureKey,
  setPendingResult,
  setShowConfirmDialog,
  setHeight,
  setCheckedTemplateIds,
  setReturnTechnique,
  reset,
} = annotationsAutoSlice.actions;

export default annotationsAutoSlice.reducer;
