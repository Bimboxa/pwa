import { createSlice } from "@reduxjs/toolkit";

const mapEditorInitialState = {
  // selector
  openBaseMapSelector: false,

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
  baseMapOpacity: 1,
  baseMapGrayScale: false,
  //
  clickInBgPosition: null, // { x, y }
  //
  selectedNode: null, // {id,nodeType,annotationType,entityId}
  //
  legendFormat: { x: 1320, y: 216, width: 200, height: 50 },
  //
  selectedAnnotationTemplateId: null,

  // polyline
  drawingPolylinePoints: [], // Array of {x, y} in relative coordinates (0-1)

  // rectangle
  drawingRectanglePoints: [], // Array of {x, y} with max 2 points (diagonal corners)

  // view
  centerBaseMapTriggeredAt: null,
};

export const mapEditorSlice = createSlice({
  name: "mapEditors",
  initialState: mapEditorInitialState,
  reducers: {
    setOpenBaseMapSelector: (state, action) => {
      state.openBaseMapSelector = action.payload;
    },
    //
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
    setBaseMapOpacity: (state, action) => {
      state.baseMapOpacity = action.payload;
    },
    setBaseMapGrayScale: (state, action) => {
      state.baseMapGrayScale = action.payload;
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

    // polyline
    setDrawingPolylinePoints: (state, action) => {
      state.drawingPolylinePoints = action.payload;
    },
    addPolylinePoint: (state, action) => {
      const point = action.payload;
      state.drawingPolylinePoints.push(point);
    },
    clearDrawingPolylinePoints: (state) => {
      state.drawingPolylinePoints = [];
    },

    // rectangle
    setDrawingRectanglePoints: (state, action) => {
      state.drawingRectanglePoints = action.payload;
    },
    addRectanglePoint: (state, action) => {
      const point = action.payload;
      // Only allow max 2 points for rectangle
      if (state.drawingRectanglePoints.length < 2) {
        state.drawingRectanglePoints.push(point);
      }
    },
    clearDrawingRectanglePoints: (state) => {
      state.drawingRectanglePoints = [];
    },

    // baseMap - view
    triggerCenterBaseMap: (state) => {
      console.log("[STATE] centerBaseMapTriggeredAt", Date.now());
      state.centerBaseMapTriggeredAt = Date.now();
    },
  },
});

export const {
  //
  setOpenBaseMapSelector,
  //
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
  setBaseMapGrayScale,
  setBaseMapOpacity,
  //
  setSelectedNode,
  //
  setLegendFormat,
  //
  setSelectedAnnotationTemplateId,

  // polyline
  setDrawingPolylinePoints,
  addPolylinePoint,
  clearDrawingPolylinePoints,

  // rectangle
  setDrawingRectanglePoints,
  addRectanglePoint,
  clearDrawingRectanglePoints,

  // view
  triggerCenterBaseMap,
} = mapEditorSlice.actions;

export default mapEditorSlice.reducer;
