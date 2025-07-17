import { createSlice } from "@reduxjs/toolkit";
import setInitProjectId from "Features/init/services/setInitProjectId";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

const onboardingInitialState = {
  step: "CREATE_PROJECT",
  //
  projectName: null,
  mapFile: null,
  mapName: null,
  issuesListingName: null,
  //
  showOverview: false,
};

export const onboardingSlice = createSlice({
  name: "onboarding",
  initialState: onboardingInitialState,
  reducers: {
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
  },
});

export const {
  setStep,
  //
  setProjectName,
  setMapFile,
  setMapName,
  setIssuesListingName,
  //
  setShowOverview,
} = onboardingSlice.actions;

export default onboardingSlice.reducer;
