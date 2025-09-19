import { createSlice } from "@reduxjs/toolkit";
import setInitProjectId from "Features/init/services/setInitProjectId";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

const onboardingInitialState = {
  //
  openPanelCreateData: false,
  //
  step: "CREATE_PROJECT",
  //
  projectName: null,
  mapFile: null,
  mapName: null,
  issuesListingName: null,
  //
  showOverview: false,

  // == v2 ==

  onboardingIsActive: false,
  baseMap: null,
  presetListingsKeys: null,
  scope: null,
  blueprint: null,
};

export const onboardingSlice = createSlice({
  name: "onboarding",
  initialState: onboardingInitialState,
  reducers: {
    setOpenPanelCreateData: (state, action) => {
      state.openPanelCreateData = action.payload;
    },
    setStep: (state, action) => {
      state.step = action.payload;
    },
    //
    setProjectName: (state, action) => {
      state.projectName = action.payload;
    },
    setMapFile: (state, action) => {
      state.mapFile = action.payload;
    },
    setMapName: (state, action) => {
      state.mapName = action.payload;
    },
    setIssuesListingName: (state, action) => {
      state.issuesListingName = action.payload;
    },
    //
    setShowOverview: (state, action) => {
      state.showOverview = action.payload;
    },
    // == v2 ==
    setOnboardingIsActive: (state, action) => {
      state.onboardingIsActive = action.payload;
    },
    setBaseMap: (state, action) => {
      state.baseMap = action.payload;
    },
    setPresetListingsKeys: (state, action) => {
      state.presetListingsKeys = action.payload;
    },
    setScope: (state, action) => {
      state.scope = action.payload;
    },
    setBlueprint: (state, action) => {
      state.blueprint = action.payload;
    },
  },
});

export const {
  setOpenPanelCreateData,
  //
  setStep,
  //
  setProjectName,
  setMapFile,
  setMapName,
  setIssuesListingName,
  //
  setShowOverview,

  // == v2 ==
  setOnboardingIsActive,
  setBaseMap,
  setPresetListingsKeys,
  setScope,
  setBlueprint,
  //
} = onboardingSlice.actions;

export default onboardingSlice.reducer;
