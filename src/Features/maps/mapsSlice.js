import {createSlice} from "@reduxjs/toolkit";

import demoProject from "./data/demoProject";

const projectsInitialState = {
  //
  projectsMap: {demo: demoProject},
  projectsUpdatedAt: null,
  //
  selectedProjectId: null,
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
