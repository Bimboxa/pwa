import {createSlice} from "@reduxjs/toolkit";

import demoProject from "./data/demoProject";

const projectsInitialState = {
  //
  projectsMap: new Map([["demo", demoProject]]),
  projectsUpdatedAt: null,
  //
  selectedProjectId: "demo",
  //
};

export const projectsSlice = createSlice({
  name: "projects",
  initialState: projectsInitialState,
  reducers: {
    setSelectedProjectId: (state, action) => {
      state.selectedProjectId = action.payload;
    },
  },
});

export const {
  setSelectedProjectId,
  //
} = projectsSlice.actions;

export default projectsSlice.reducer;
