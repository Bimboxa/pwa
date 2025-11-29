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
  openDialogAutoSelectAnnotationTemplateToCreateEntity: false,
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
  editedNode: null, // {id,nodeType,annotationType,entityId}
  canTransformNode: false, // boolean
  annotationToolbarPosition: null,
  //
  legendFormat: { x: 1320, y: 216, width: 200, height: 50 },
  //
  selectedAnnotationTemplateId: null,

  // baseMap
  clickInBaseMapPosition: null, // { x, y }

  // polyline
  drawingPolylinePoints: [], // Array of {x, y} in relative coordinates (0-1)

  // rectangle
  drawingRectanglePoints: [], // Array of {x, y} with max 2 points (diagonal corners)

  // segment
  drawingSegmentPoints: [], // Array of {x, y} with max 2 points (start and end)

  // files drop

  filesDrop: null, // {x, y, files}

  // view
  centerBaseMapTriggeredAt: null,
  filterByMainBaseMap: true,
  zoomTo: null,
  screenToBaseLocalUpdatedAt: null,

  // scale
  scaleInPx: null,
  scaleAnnotationId: null,
  anchorPositionScale: null,

  // latlng
  anchorPositionLatLng: null,
  latLng: null,

  // fixed length
  fixedLength: null,
  fixedDims: null, // "x; y"
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
    setScaleAnnotationId: (state, action) => {
      state.scaleAnnotationId = action.payload;
    },
    // latlng
    setAnchorPositionLatLng: (state, action) => {
      state.anchorPositionLatLng = action.payload;
    },
    setLatLng: (state, action) => {
      state.latLng = action.payload;
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
    setEditedNode: (state, action) => {
      state.editedNode = action.payload;
    },
    setCanTransformNode: (state, action) => {
      state.canTransformNode = action.payload;
    },
    setAnnotationToolbarPosition: (state, action) => {
      state.annotationToolbarPosition = action.payload;
    },

    // Annotation template
    setSelectedAnnotationTemplateId: (state, action) => {
      state.selectedAnnotationTemplateId = action.payload;
    },
    // baseMap
    setClickInBaseMapPosition: (state, action) => {
      state.clickInBaseMapPosition = action.payload;
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

    // segment
    setDrawingSegmentPoints: (state, action) => {
      state.drawingSegmentPoints = action.payload;
    },
    addSegmentPoint: (state, action) => {
      const point = action.payload;
      // Only allow max 2 points for segment
      if (state.drawingSegmentPoints.length < 2) {
        state.drawingSegmentPoints.push(point);
      }
    },
    clearDrawingSegmentPoints: (state) => {
      state.drawingSegmentPoints = [];
    },

    // files drop
    setFilesDrop: (state, action) => {
      state.filesDrop = action.payload;
    },

    // baseMap - view
    triggerCenterBaseMap: (state) => {
      console.log("[STATE] centerBaseMapTriggeredAt", Date.now());
      state.centerBaseMapTriggeredAt = Date.now();
    },

    setFilterByMainBaseMap: (state, action) => {
      state.filterByMainBaseMap = action.payload;
    },
    setZoomTo: (state, action) => {
      const zoomTo = action.payload;
      state.zoomTo = { ...zoomTo, triggeredAt: Date.now() };
    },
    triggerScreenToBaseLocalUpdate: (state) => {
      state.screenToBaseLocalUpdatedAt = Date.now();
    },

    // dialogs
    setOpenDialogAutoSelectAnnotationTemplateToCreateEntity: (
      state,
      action
    ) => {
      state.openDialogAutoSelectAnnotationTemplateToCreateEntity =
        action.payload;
    },

    // fixed length
    setFixedLength: (state, action) => {
      state.fixedLength = action.payload;
    },
    setFixedDims: (state, action) => {
      state.fixedDims = action.payload;
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
  setScaleAnnotationId,
  //
  setAnchorPositionLatLng,
  setLatLng,
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
  setEditedNode,
  setCanTransformNode,
  setAnnotationToolbarPosition,
  //
  setLegendFormat,
  //
  setSelectedAnnotationTemplateId,
  // baseMap
  setClickInBaseMapPosition,

  // polyline
  setDrawingPolylinePoints,
  addPolylinePoint,
  clearDrawingPolylinePoints,

  // fixed
  setFixedLength,
  setFixedDims,

  // rectangle
  setDrawingRectanglePoints,
  addRectanglePoint,
  clearDrawingRectanglePoints,

  // segment
  setDrawingSegmentPoints,
  addSegmentPoint,
  clearDrawingSegmentPoints,

  // files drop
  setFilesDrop,

  // view
  triggerCenterBaseMap,
  setFilterByMainBaseMap,
  setZoomTo,
  triggerScreenToBaseLocalUpdate,
  // dialogs
  setOpenDialogAutoSelectAnnotationTemplateToCreateEntity,
} = mapEditorSlice.actions;

export default mapEditorSlice.reducer;
