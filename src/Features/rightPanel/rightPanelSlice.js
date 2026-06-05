import { bottomNavigationActionClasses } from "@mui/material";
import { createSlice } from "@reduxjs/toolkit";

const rightPanelInitialState = {
  width: 300, // fixed width for all tools except ELEVATION
  elevationWidth: 300, // resizable width, ELEVATION tool only
  //
  selectedMenuItemKey: null, // SHOWER, ENTITY, ANNOTATION_FORMAT
  //
  selectedScopeIdInDashboard: null,
};

export const rightPanelSlice = createSlice({
  name: "rightPanel",
  initialState: rightPanelInitialState,
  reducers: {
    setSelectedMenuItemKey: (state, action) => {
      state.selectedMenuItemKey = action.payload;
    },
    setElevationWidth: (state, action) => {
      state.elevationWidth = action.payload;
    },
  },
});

export const { setSelectedMenuItemKey, setElevationWidth } =
  rightPanelSlice.actions;

export default rightPanelSlice.reducer;
