import { createSlice } from "@reduxjs/toolkit";

const mapEditorInitialState = {
  // main map
  selectedBaseMapsListingId: null,
  selectedBaseMapId: null,
  loadedMainBaseMapId: null,
  //
  showShapes: true,
  //
  enabledDrawingMode: null, // "MARKER"
  //
  showLayerScreenCursor: false,
  printModeEnabled: false,
  //
  bgImageKey: "DEFAULT", // "DEFAULT"
  //
  mainBaseMapIsSelected: false,
  baseMapPoseInBg: { x: 40, y: 40, k: 1 },
  //
  clickInBgPosition: null, // { x, y }
  //
  selectedNode: null, // {id,nodeType,annotationType,entityId}
  //
  legendFormat: { x: 1320, y: 216, width: 200, height: 50 },
  //
  selectedAnnotationTemplateId: null,
};

export const mapEditorSlice = createSlice({
  name: "mapEditors",
  initialState: mapEditorInitialState,
  reducers: {
    setSelectedBaseMapsListingId: (state, action) => {
      state.selectedBaseMapsListingId = action.payload;
    },
    setSelectedMainBaseMapId: (state, action) => {
      console.log("[STATE] selectedBaseMapId", action.payload);
      state.selectedBaseMapId = action.payload;
    },
    setLoadedMainBaseMapId: (state, action) => {
      state.loadedMainBaseMapId = action.payload;
    },
    setShowShapes: (state, action) => {
      state.showShapes = action.payload;
    },
    setEnabledDrawingMode: (state, action) => {
      const drawingMode = action.payload;
      state.enabledDrawingMode = drawingMode;
      state.showLayerScreenCursor = Boolean(drawingMode);
    },
    // scale
    setAnchorPositionScale: (state, action) => {
      state.anchorPositionScale = action.payload;
    },
    setScaleInPx: (state, action) => {
      state.scaleInPx = action.payload;
    },
    // layers
    setShowLayerScreenCursor: (state, action) => {
      state.showLayerScreenCursor = action.payload;
    },
    // print mode
    setPrintModeEnabled: (state, action) => {
      state.printModeEnabled = action.payload;
    },
    // bgImage
    setBgImageKey: (state, action) => {
      state.bgImageKey = action.payload;
    },
    setClickInBgPosition: (state, action) => {
      state.clickInBgPosition = action.payload;
    },
    // Main Base Map
    setMainBaseMapIsSelected: (state, action) => {
      state.mainBaseMapIsSelected = action.payload;
    },
    setBaseMapPoseInBg: (state, action) => {
      state.baseMapPoseInBg = action.payload;
    },
    // Legend
    setLegendFormat: (state, action) => {
      state.legendFormat = action.payload;
    },

    // Nodes
    setSelectedNode: (state, action) => {
      state.selectedNode = action.payload;
    },

    // Annotation template
    setSelectedAnnotationTemplateId: (state, action) => {
      state.selectedAnnotationTemplateId = action.payload;
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
  //
  setShowLayerScreenCursor,
  //
  setPrintModeEnabled,
  //
  setBgImageKey,
  setClickInBgPosition,
  //
  setMainBaseMapIsSelected,
  setBaseMapPoseInBg,
  //
  setSelectedNode,
  //
  setLegendFormat,
  //
  setSelectedAnnotationTemplateId,
} = mapEditorSlice.actions;

export default mapEditorSlice.reducer;
