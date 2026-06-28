import { bottomNavigationActionClasses } from "@mui/material";
import { createSlice } from "@reduxjs/toolkit";

const rightPanelInitialState = {
  width: 300, // fixed width for all tools except resizable ones
  elevationWidth: 300, // resizable width, MESH tool
  // Resizable width for the ELEVATION baseMap-viewer panel. Null = not yet
  // customized → defaults to 50% of the viewer (computed at render).
  elevationViewerWidth: null,
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
    setElevationViewerWidth: (state, action) => {
      state.elevationViewerWidth = action.payload;
    },
  },
});

export const {
  setSelectedMenuItemKey,
  setElevationWidth,
  setElevationViewerWidth,
} = rightPanelSlice.actions;

export default rightPanelSlice.reducer;
