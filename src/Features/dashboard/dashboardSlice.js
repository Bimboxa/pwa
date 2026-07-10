import { createSlice } from "@reduxjs/toolkit";

const dashboardInitialState = {
  //
  selectedMenuItemKey: "MY_SCOPES", // MY_SCOPES, PROJECTS
  //
  selectedScopeIdInDashboard: null,
  // composite key of the selected project item in the master/detail dashboard
  // (`local_<projectId>` or `remote_<idMaster|clientRef>`)
  selectedProjectKeyInDashboard: null,
};

export const dashboardSlice = createSlice({
  name: "dashboard",
  initialState: dashboardInitialState,
  reducers: {
    setSelectedMenuItemKey: (state, action) => {
      state.selectedMenuItemKey = action.payload;
    },
    //
    setSelectedScopeIdInDashboard: (state, action) => {
      state.selectedScopeIdInDashboard = action.payload;
    },
    //
    setSelectedProjectKeyInDashboard: (state, action) => {
      state.selectedProjectKeyInDashboard = action.payload;
    },
  },
});

export const {
  setSelectedMenuItemKey,
  setSelectedScopeIdInDashboard,
  setSelectedProjectKeyInDashboard,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;
