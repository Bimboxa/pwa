import { createSlice } from "@reduxjs/toolkit";

const mapEditorInitialState = {
  // main map
  selectedBaseMapsListingId: null,
  selectedMainBaseMapId: null,
  loadedMainBaseMapId: null,

  //
  showShapes: true,
  //
  enabledDrawingMode: null,
};

export const mapEditorSlice = createSlice({
  name: "mapEditors",
  initialState: mapEditorInitialState,
  reducers: {
    setSelectedBaseMapsListingId: (state, action) => {
      state.selectedBaseMapsListingId = action.payload;
    },
    setSelectedMainBaseMapId: (state, action) => {
      console.log("[STATE] selectedMainBaseMapId", action.payload);
      state.selectedMainBaseMapId = action.payload;
    },
    setLoadedMainBaseMapId: (state, action) => {
      state.loadedMainBaseMapId = action.payload;
    },
    setShowShapes: (state, action) => {
      state.showShapes = action.payload;
    },
    setEnabledDrawingMode: (state, action) => {
      state.enabledDrawingMode = action.payload;
    },
    // scale
    setAnchorPositionScale: (state, action) => {
      state.anchorPositionScale = action.payload;
    },
    setScaleInPx: (state, action) => {
      state.scaleInPx = action.payload;
    },
  },
});

export const {
  setSelectedBaseMapsListingId,
  setSelectedMainBaseMapId,
  setLoadedMainBaseMapId,
  //
  setShowShapes,
  setEnabledDrawingMode,
  //
  setAnchorPositionScale,
  setScaleInPx,
} = mapEditorSlice.actions;

export default mapEditorSlice.reducer;
