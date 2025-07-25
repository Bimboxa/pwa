import { bottomNavigationActionClasses } from "@mui/material";
import { createSlice } from "@reduxjs/toolkit";

const dashboardInitialState = {
  //
  selectedMenuItemKey: "MY_SCOPES", // MY_SCOPES, PROJECTS
  //
  selectedScopeIdInDashboard: null,
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
  },
});

export const { setSelectedMenuItemKey, setSelectedScopeIdInDashboard } =
  dashboardSlice.actions;

export default dashboardSlice.reducer;
