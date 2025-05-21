import {createSlice} from "@reduxjs/toolkit";

const mapEditorInitialState = {
  // selector
  selectedMapsListingId: null,

  // main map
  loadedMainMapId: null,
  //
  showShapes: true,
  //
  enabledDrawingMode: null,
};

export const mapEditorSlice = createSlice({
  name: "mapEditors",
  initialState: mapEditorInitialState,
  reducers: {
    setSelectedMapsListingId: (state, action) => {
      state.selectedMapsListingId = action.payload;
    },
    setLoadedMainMapId: (state, action) => {
      state.loadedMainMapId = action.payload;
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
  setSelectedMapsListingId,
  setLoadedMainMapId,
  setShowShapes,
  setEnabledDrawingMode,
  //
  setAnchorPositionScale,
  setScaleInPx,
} = mapEditorSlice.actions;

export default mapEditorSlice.reducer;
