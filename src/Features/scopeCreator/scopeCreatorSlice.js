import { createSlice } from "@reduxjs/toolkit";

const scopeCreatorInitialState = {
  openScopeCreator: false,

  stepPanelWidth: 350,

  stepKey: "SEARCH_PROJECT",
  // one-shot step applied when the creator dialog opens (survives the
  // StrictMode double-mount of PageScopeCreator, which resets stepKey)
  initialStepKey: null,

  selectedProjectId: null,
  selectedPresetScopeKey: null,

  selectedMasterProject: null,
};

export const scopeCreatorSlice = createSlice({
  name: "scopeCreator",
  initialState: scopeCreatorInitialState,
  reducers: {
    setOpenScopeCreator: (state, action) => {
      state.openScopeCreator = action.payload;
      if (!action.payload) state.initialStepKey = null;
    },
    setStepKey: (state, action) => {
      state.stepKey = action.payload;
    },
    setInitialStepKey: (state, action) => {
      state.initialStepKey = action.payload;
    },
    //
    setSelectedProjectId: (state, action) => {
      state.selectedProjectId = action.payload;
    },
    setSelectedPresetScopeKey: (state, action) => {
      state.selectedPresetScopeKey = action.payload;
    },
    setSelectedMasterProject: (state, action) => {
      state.selectedMasterProject = action.payload;
    },
  },
});

export const {
  setOpenScopeCreator,
  setStepKey,
  setInitialStepKey,
  //
  setSelectedProjectId,
  setSelectedPresetScopeKey,
} = scopeCreatorSlice.actions;

export default scopeCreatorSlice.reducer;
