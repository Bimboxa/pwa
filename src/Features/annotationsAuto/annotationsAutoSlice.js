import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  selectedSourceListingId: null,
  selectedProcedureKey: null,
  pendingResult: null,
  showConfirmDialog: false,
  height: null,
  returnTechnique: true,
  running: false,
};

export const annotationsAutoSlice = createSlice({
  name: "annotationsAuto",
  initialState,
  reducers: {
    setSelectedSourceListingId: (state, action) => {
      state.selectedSourceListingId = action.payload;
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
    setReturnTechnique: (state, action) => {
      state.returnTechnique = action.payload;
    },
    setRunning: (state, action) => {
      state.running = action.payload;
    },
    reset: () => initialState,
  },
});

export const {
  setSelectedSourceListingId,
  setSelectedProcedureKey,
  setPendingResult,
  setShowConfirmDialog,
  setHeight,
  setReturnTechnique,
  setRunning,
  reset,
} = annotationsAutoSlice.actions;

export default annotationsAutoSlice.reducer;
