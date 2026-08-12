import { createSlice } from "@reduxjs/toolkit";

const rightPanelInitialState = {
  width: 340, // fixed width for all tools except resizable ones
  elevationWidth: 300, // resizable width, MESH tool
  // Resizable width for the ELEVATION baseMap-viewer panel. Null = not yet
  // customized → defaults to 50% of the viewer (computed at render).
  elevationViewerWidth: null,
  // Resizable width for the RESOURCES panel. Null = not yet customized →
  // defaults to 40% of the viewport (computed at render).
  resourcesWidth: null,
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
    setResourcesWidth: (state, action) => {
      state.resourcesWidth = action.payload;
    },
  },
});

export const {
  setSelectedMenuItemKey,
  setElevationWidth,
  setElevationViewerWidth,
  setResourcesWidth,
} = rightPanelSlice.actions;

export default rightPanelSlice.reducer;
