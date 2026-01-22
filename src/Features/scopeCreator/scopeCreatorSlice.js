import { createSlice } from "@reduxjs/toolkit";

const scopeCreatorInitialState = {
  openScopeCreator: false,

  stepPanelWidth: 350,

  stepKey: "SEARCH_PROJECT",

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
    },
    setStepKey: (state, action) => {
      state.stepKey = action.payload;
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
  //
  setSelectedProjectId,
  setSelectedPresetScopeKey,
} = scopeCreatorSlice.actions;

export default scopeCreatorSlice.reducer;
