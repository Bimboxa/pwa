import { createSlice } from "@reduxjs/toolkit";
import setInitSelectedMainBaseMapId from "Features/init/services/setInitSelectedMainBaseMapId";

const mapEditorInitialState = {
  // selector
  openBaseMapSelector: false,
  showCreateBaseMapSection: false,

  // main map
  selectedBaseMapsListingId: null,
  selectedBaseMapId: null,
  loadedMainBaseMapId: null,
  //
  showMapListingsPanel: false,
  //
  mapEditorMode: "SELECT", // "SELECT", "DRAW"
  enabledDrawingMode: null, // "CLICK", "RECTANGLE", "SURFACE_DROP",
  autoMergeOnCommit: true, // when true, a POLYGON drawn via RECTANGLE tool is auto-merged with overlapping same-template polygons on commit
  autoOffsetsOnCommit: false, // when true, a POLYGON drawn via CLICK tool inherits offsetZ/height + per-point offsetBottom/offsetTop from snapped neighbors so the 3D surface stays continuous
  avoidVisibleAnnotationsOnCommit: false, // when true, on commit of a POLYGON, visible annotations of a different annotationTemplateId are subtracted from the drawn polygon (outer carving + cuts)
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
  selectedNodes: [], // Array of {id,nodeType,annotationType,entityId}
  editedNode: null, // {id,nodeType,annotationType,entityId}
  canTransformNode: false, // boolean
  wrapperMode: false, // true = show bbox wrapper for point-based annotations
  annotationToolbarPosition: null,
  annotationsToolbarPosition: null,
  tempAnnotationToolbarPosition: null,
  toolbarDragOffset: { x: 0, y: 0 },
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
  angleInRad: null,
  scaleAnnotationId: null,
  anchorPositionScale: null,

  // latlng
  anchorPositionLatLng: null,
  latLng: null,

  // fixed length
  fixedLength: null,
  fixedDims: null, // "x; y"

  // Rectangle X/Y typed-dimensions (keyboard-driven during RECTANGLE drawing,
  // displayed in the bottom-bar which lives outside the per-viewer providers,
  // so the state is in Redux rather than DrawingMetricsContext).
  rectXBuffer: "",
  rectYBuffer: "",
  rectCurrentAxis: null, // 'x' | 'y' | null
  rectHasFirstPoint: false,

  // Segment-length constraint buffer (digits typed while drawing CLICK /
  // POLYLINE_CLICK / etc.). Mirrors the previous DrawingMetricsContext
  // state — moved to Redux so the bottom bar can read it.
  constraintBuffer: "",

  // last selected drawing tool per annotation template / tool type
  selectedToolKeyByTemplateId: {}, // { [templateId|toolType]: toolKey }

  // anchor snap mode
  anchorSourceAnnotationId: null, // annotation ID whose extremities will be anchored

  // ortho snap
  orthoSnapEnabled: false,
  orthoSnapAngleOffset: 0, // degrees

  // smart detect (unified activation across drawing tools)
  smartDetectEnabled: false, // switch "Actif" — when true, active drawing tool triggers its auto-detection algorithm
  smartDetectionPresent: false, // true when a detection is currently available (flashes the Space shortcut badge)
  loupeAspect: "SQUARE", // "SQUARE" | "LANDSCAPE" | "PORTRAIT"

  // strip detection orientation (used by STRIP + smart, POLYLINE_CLICK + smart)
  stripDetectionOrientation: "H", // "H" | "V"
  stripDetectionMultiple: false, // false → only the band closest to the loupe center; true → all parallel bands

  // printable map (lazy mount for export/pdf only)
  showPrintableMap: false,

  // copy/paste of annotations
  // pasteClipboard: { annotation, basePoints, baseCuts, basePoint, basePointSize, sourceCenter }
  //   annotation     — source annotation object (hydrated, with template)
  //   basePoints     — pixel-image points snapshot at Ctrl+C (POLYGON/POLYLINE/STRIP)
  //   baseCuts       — pixel-image cut points snapshot (POLYGON only)
  //   basePoint      — pixel-image single point (POINT/MARKER)
  //   basePointSize  — visual hint size for ghost rendering of point-types
  //   sourceCenter   — { x, y } center used as transform origin and ghost anchor
  pasteClipboard: null,
  pasteTransform: { rotationDeg: 0, flipX: false },
  // copy/paste pattern detection sub-mode: null | "GLOBAL" | "HOVER"
  pasteDetectionMode: null,
};

export const mapEditorSlice = createSlice({
  name: "mapEditors",
  initialState: mapEditorInitialState,
  reducers: {
    setOpenBaseMapSelector: (state, action) => {
      state.openBaseMapSelector = action.payload;
    },
    setShowCreateBaseMapSection: (state, action) => {
      state.showCreateBaseMapSection = action.payload;
    },
    //
    setSelectedBaseMapsListingId: (state, action) => {
      state.selectedBaseMapsListingId = action.payload;
    },
    setSelectedMainBaseMapId: (state, action) => {
      console.log("[STATE] selectedBaseMapId", action.payload);
      state.selectedBaseMapId = action.payload;
      setInitSelectedMainBaseMapId(action.payload);
    },
    setLoadedMainBaseMapId: (state, action) => {
      state.loadedMainBaseMapId = action.payload;
    },
    toggleShowMapListingsPanel: (state) => {
      state.showMapListingsPanel = !state.showMapListingsPanel;
    },
    setEnabledDrawingMode: (state, action) => {
      const drawingMode = action.payload;
      state.enabledDrawingMode = drawingMode;
      state.showLayerScreenCursor = Boolean(drawingMode);
    },
    setAutoMergeOnCommit: (state, action) => {
      state.autoMergeOnCommit = action.payload;
    },
    setAutoOffsetsOnCommit: (state, action) => {
      state.autoOffsetsOnCommit = action.payload;
    },
    setAvoidVisibleAnnotationsOnCommit: (state, action) => {
      state.avoidVisibleAnnotationsOnCommit = action.payload;
    },
    setMapEditorMode: (state, action) => {
      state.mapEditorMode = action.payload;
    },
    // scale
    setAnchorPositionScale: (state, action) => {
      state.anchorPositionScale = action.payload;
    },
    setScaleInPx: (state, action) => {
      state.scaleInPx = action.payload;
    },
    setAngleInRad: (state, action) => {
      state.angleInRad = action.payload;
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

    // Wrapper mode
    setWrapperMode: (state, action) => {
      state.wrapperMode = action.payload;
    },
    // Nodes
    setSelectedNode: (state, action) => {
      state.selectedNode = action.payload;
      state.wrapperMode = false;
    },
    setSelectedNodes: (state, action) => {
      state.selectedNodes = action.payload;
    },
    toggleSelectedNode: (state, action) => {
      const node = action.payload;
      if (state.selectedNodes.map((n) => n.nodeId).includes(node.nodeId)) {
        state.selectedNodes = state.selectedNodes.filter(
          (n) => n.nodeId !== node.nodeId
        );
      } else {
        state.selectedNodes.push(node);
      }
    },
    addSelectedNodes: (state, action) => {
      const nodes = action.payload;
      state.selectedNodes.push(...nodes);
    },
    removeSelectedNodes: (state, action) => {
      const nodes = action.payload;
      state.selectedNodes = state.selectedNodes.filter(
        (node) => !nodes.map((node) => node.nodeId).includes(node.nodeId)
      );
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
    setToolbarDragOffset: (state, action) => {
      state.toolbarDragOffset = action.payload;
    },
    setAnnotationsToolbarPosition: (state, action) => {
      state.annotationsToolbarPosition = action.payload;
    },
    setTempAnnotationToolbarPosition: (state, action) => {
      state.tempAnnotationToolbarPosition = action.payload;
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

    // rectangle typed X/Y dimensions
    setRectXBuffer: (state, action) => {
      state.rectXBuffer = action.payload;
    },
    setRectYBuffer: (state, action) => {
      state.rectYBuffer = action.payload;
    },
    appendToRectXBuffer: (state, action) => {
      state.rectXBuffer = state.rectXBuffer + action.payload;
    },
    appendToRectYBuffer: (state, action) => {
      state.rectYBuffer = state.rectYBuffer + action.payload;
    },
    deleteLastRectXBuffer: (state) => {
      state.rectXBuffer = state.rectXBuffer.slice(0, -1);
    },
    deleteLastRectYBuffer: (state) => {
      state.rectYBuffer = state.rectYBuffer.slice(0, -1);
    },
    toggleRectXBufferSign: (state) => {
      state.rectXBuffer = state.rectXBuffer.startsWith("-")
        ? state.rectXBuffer.slice(1)
        : "-" + state.rectXBuffer;
    },
    toggleRectYBufferSign: (state) => {
      state.rectYBuffer = state.rectYBuffer.startsWith("-")
        ? state.rectYBuffer.slice(1)
        : "-" + state.rectYBuffer;
    },
    setRectCurrentAxis: (state, action) => {
      state.rectCurrentAxis = action.payload;
    },
    setRectHasFirstPoint: (state, action) => {
      state.rectHasFirstPoint = action.payload;
    },
    clearRectDims: (state) => {
      state.rectXBuffer = "";
      state.rectYBuffer = "";
      state.rectCurrentAxis = null;
    },

    // segment-length constraint buffer
    setConstraintBuffer: (state, action) => {
      state.constraintBuffer = action.payload;
    },
    appendToConstraintBuffer: (state, action) => {
      state.constraintBuffer = state.constraintBuffer + action.payload;
    },
    deleteLastConstraintBuffer: (state) => {
      state.constraintBuffer = state.constraintBuffer.slice(0, -1);
    },
    clearConstraintBuffer: (state) => {
      state.constraintBuffer = "";
    },

    // selected tool per template
    setSelectedToolKeyForTemplate: (state, action) => {
      const { templateId, toolKey } = action.payload;
      state.selectedToolKeyByTemplateId[templateId] = toolKey;
    },

    // anchor snap
    setAnchorSourceAnnotationId: (state, action) => {
      state.anchorSourceAnnotationId = action.payload;
      state.showLayerScreenCursor = Boolean(action.payload);
    },

    // ortho snap
    setOrthoSnapEnabled: (state, action) => {
      state.orthoSnapEnabled = action.payload;
    },
    setOrthoSnapAngleOffset: (state, action) => {
      state.orthoSnapAngleOffset = action.payload;
    },
    setStripDetectionOrientation: (state, action) => {
      state.stripDetectionOrientation = action.payload;
    },
    toggleStripDetectionOrientation: (state) => {
      state.stripDetectionOrientation =
        state.stripDetectionOrientation === "H" ? "V" : "H";
    },
    setStripDetectionMultiple: (state, action) => {
      state.stripDetectionMultiple = action.payload;
    },

    // smart detect
    setSmartDetectEnabled: (state, action) => {
      state.smartDetectEnabled = action.payload;
      if (action.payload) {
        if (state.loupeAspect === "SQUARE") state.loupeAspect = "LANDSCAPE";
      } else {
        state.loupeAspect = "SQUARE";
      }
    },
    toggleSmartDetectEnabled: (state) => {
      state.smartDetectEnabled = !state.smartDetectEnabled;
      if (state.smartDetectEnabled) {
        if (state.loupeAspect === "SQUARE") state.loupeAspect = "LANDSCAPE";
      } else {
        state.loupeAspect = "SQUARE";
      }
    },
    setSmartDetectionPresent: (state, action) => {
      state.smartDetectionPresent = action.payload;
    },

    // loupe aspect
    setLoupeAspect: (state, action) => {
      state.loupeAspect = action.payload;
    },
    cycleLoupeAspect: (state) => {
      // Skip SQUARE: in smartDetect mode, only landscape ↔ portrait makes sense.
      state.loupeAspect = state.loupeAspect === "LANDSCAPE" ? "PORTRAIT" : "LANDSCAPE";
    },
    setShowPrintableMap: (state, action) => {
      state.showPrintableMap = action.payload;
    },

    // copy/paste of annotations
    setPasteClipboard: (state, action) => {
      state.pasteClipboard = action.payload;
      state.pasteTransform = { rotationDeg: 0, flipX: false };
      state.pasteDetectionMode = null;
    },
    clearPasteClipboard: (state) => {
      state.pasteClipboard = null;
      state.pasteTransform = { rotationDeg: 0, flipX: false };
      state.pasteDetectionMode = null;
    },
    setPasteDetectionMode: (state, action) => {
      state.pasteDetectionMode = action.payload;
    },
    rotatePasteClipboard: (state) => {
      state.pasteTransform.rotationDeg =
        (state.pasteTransform.rotationDeg + 90) % 360;
    },
    flipPasteClipboardX: (state) => {
      state.pasteTransform.flipX = !state.pasteTransform.flipX;
    },
  },
});

export const {
  //
  setOpenBaseMapSelector,
  setShowCreateBaseMapSection,
  //
  setSelectedBaseMapsListingId,
  setSelectedMainBaseMapId,
  setLoadedMainBaseMapId,
  //
  toggleShowMapListingsPanel,
  setEnabledDrawingMode,
  setAutoMergeOnCommit,
  setAutoOffsetsOnCommit,
  setAvoidVisibleAnnotationsOnCommit,
  setMapEditorMode,
  //
  setAnchorPositionScale,
  setScaleInPx,
  setAngleInRad,
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
  setWrapperMode,
  setSelectedNode,
  setSelectedNodes,
  addSelectedNodes,
  toggleSelectedNode,
  removeSelectedNodes,
  setEditedNode,
  setCanTransformNode,
  setAnnotationToolbarPosition,
  setToolbarDragOffset,
  setAnnotationsToolbarPosition,
  setTempAnnotationToolbarPosition,
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

  // rectangle typed X/Y dimensions
  setRectXBuffer,
  setRectYBuffer,
  appendToRectXBuffer,
  appendToRectYBuffer,
  deleteLastRectXBuffer,
  deleteLastRectYBuffer,
  toggleRectXBufferSign,
  toggleRectYBufferSign,
  setRectCurrentAxis,
  setRectHasFirstPoint,
  clearRectDims,

  // segment-length constraint buffer
  setConstraintBuffer,
  appendToConstraintBuffer,
  deleteLastConstraintBuffer,
  clearConstraintBuffer,

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

  // selected tool per template
  setSelectedToolKeyForTemplate,

  // anchor snap
  setAnchorSourceAnnotationId,

  // ortho snap
  setOrthoSnapEnabled,
  setOrthoSnapAngleOffset,

  // strip detection
  setStripDetectionOrientation,
  toggleStripDetectionOrientation,
  setStripDetectionMultiple,

  // smart detect
  setSmartDetectEnabled,
  toggleSmartDetectEnabled,
  setSmartDetectionPresent,

  // loupe aspect
  setLoupeAspect,
  cycleLoupeAspect,

  // printable map
  setShowPrintableMap,

  // copy/paste
  setPasteClipboard,
  clearPasteClipboard,
  rotatePasteClipboard,
  flipPasteClipboardX,
  setPasteDetectionMode,
} = mapEditorSlice.actions;

export default mapEditorSlice.reducer;
