import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  selectedSourceListingId: null,
  selectedProcedureKey: null,
  selectedAnnotationTemplateId: null,
  pendingResult: null,
  showConfirmDialog: false,
  height: null,
  waterHeight: null,
  returnTechnique: true,
  ignoreInteriorWalls: false,
  // {[procedureKey]: {[optionKey]: boolean}} — values of the boolean options a
  // procedure declares in its registry entry (`options`); a missing value
  // falls back to the option's `default` (see getProcedureOptions).
  optionsByProcedureKey: {},
  running: false,
  // {procedureKey, sourceAnnotationId} | null — armed by the drawing commit
  // when the source template links a procedure flagged launchOnSourceCreated;
  // consumed by ProcedureAutoLaunchDialogOutlet (params dialog auto-open).
  pendingProcedureLaunch: null,
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
    setSelectedAnnotationTemplateId: (state, action) => {
      state.selectedAnnotationTemplateId = action.payload;
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
    setWaterHeight: (state, action) => {
      state.waterHeight = action.payload;
    },
    setReturnTechnique: (state, action) => {
      state.returnTechnique = action.payload;
    },
    setIgnoreInteriorWalls: (state, action) => {
      state.ignoreInteriorWalls = action.payload;
    },
    setProcedureOption: (state, action) => {
      const { procedureKey, key, value } = action.payload;
      state.optionsByProcedureKey[procedureKey] = {
        ...state.optionsByProcedureKey[procedureKey],
        [key]: value,
      };
    },
    setRunning: (state, action) => {
      state.running = action.payload;
    },
    setPendingProcedureLaunch: (state, action) => {
      state.pendingProcedureLaunch = action.payload;
    },
    reset: () => initialState,
  },
});

export const {
  setSelectedSourceListingId,
  setSelectedProcedureKey,
  setSelectedAnnotationTemplateId,
  setPendingResult,
  setShowConfirmDialog,
  setHeight,
  setWaterHeight,
  setReturnTechnique,
  setIgnoreInteriorWalls,
  setProcedureOption,
  setRunning,
  setPendingProcedureLaunch,
  reset,
} = annotationsAutoSlice.actions;

export default annotationsAutoSlice.reducer;
