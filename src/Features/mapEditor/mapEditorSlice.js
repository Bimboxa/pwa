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
  repairMode: "AUTO", // localized-repair type override: "AUTO" | "L" | "T" | "SMOOTH"
  autoMergeOnCommit: true, // when true, a POLYGON drawn via RECTANGLE tool is auto-merged with overlapping same-template polygons on commit
  autoOffsetsOnCommit: false, // when true, a POLYGON drawn via CLICK tool inherits offsetZ/height + per-point offsetBottom/offsetTop from snapped neighbors so the 3D surface stays continuous
  avoidVisibleAnnotationsOnCommit: false, // when true, on commit of a POLYGON, visible annotations of a different annotationTemplateId are subtracted from the drawn polygon (outer carving + cuts)
  // RAMP tool — transient params shown in the bottom drawing toolbar while the
  // "Rampe" tool is active. Not persisted on the annotation/template.
  rampWidthM: 1, // band width in meters, centered on the drawn median line
  rampDeltaHM: 0, // vertical delta (meters) over the median line length → slopePct
  // Opening (ouverture) tools drawn from a polyline/stripe centerline — last
  // line width entered by the user, reused next time such a tool is activated.
  // Defaults to 20 cm.
  openingStrokeWidth: 20,
  openingStrokeWidthUnit: "CM",
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
  legendFormat: {
    x: 1320,
    y: 216,
    width: 200,
    height: 50,
    fontSize: 12,
    showQty: true,
  },
  //
  imageModeEnabled: false,
  imageModeLegendSelected: false,
  // image mode capture rectangle (screen space)
  imageModeAspectRatio: "LANDSCAPE", // "LANDSCAPE" | "SQUARE" | "PORTRAIT"
  imageModeHighRes: false, // when true, captureMapAsPng doubles the output pixel ratio
  imageModeShowWatermark: false, // when true, render the org's watermark SVG inside the capture rect
  imageModeShowLogo: false, // when true, render the org's logo SVG anchored bottom-right of the capture rect
  imageModeWhiteBackground: false, // when true, captureMapAsPng fills the canvas with white (no transparency)
  // legend overlay: position/size in pixels relative to the capture rect.
  // x/y default to null → resolved at render time to "top-right" of the
  // capture rect (so the default works for any aspect ratio + viewport).
  // The user dragging pins them to numeric pixel values.
  imageModeLegendOverlay: {
    x: null,
    y: null,
    width: 240,
    fontSize: 12,
    showQty: true,
    visible: true,
  },
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
  subtractSourceAnnotationId: null, // POLYGON ID being carved; next clicked annotation becomes a subtraction

  // ortho snap
  orthoSnapEnabled: false,
  orthoSnapAngleOffset: 0, // degrees

  // 2D editor settings (transient UI preferences).
  // Multiplier applied to the vertex handle size in NodePolylineStatic.
  vertexSizeMultiplier: 1,

  // clipping plane (2D-defined cut plane, mirrored to the 3D viewer).
  // Coords are normalized [0..1] vs baseMap imageSize. Transient (not persisted).
  clippingPlanEnabled: false,
  clippingPlan: {
    pointA: null, // { x, y } normalized
    pointB: null, // { x, y } normalized
    sign: 1, // +1 / -1 : cut direction
    baseMapId: null,
  },

  // smart detect (unified activation across drawing tools)
  smartDetectEnabled: false, // switch "Actif" — when true, active drawing tool triggers its auto-detection algorithm
  smartDetectionPresent: false, // true when a detection is currently available (flashes the Space shortcut badge)
  loupeAspect: "SQUARE", // "SQUARE" | "LANDSCAPE" | "PORTRAIT"
  smartDetectMode: "HOVER", // "HOVER" (loupe-based, S) | "GLOBAL" (whole-plan, A) | "VECTOR" (wall vectorization, V)
  globalDetectionRunning: false, // true while the mocked global-detection async run is in flight

  // strip detection multi-band (used by STRIP + smart, POLYLINE_CLICK + smart)
  stripDetectionMultiple: false, // false → only the band closest to the loupe center; true → all parallel bands

  // printable map (lazy mount for export/pdf only)
  showPrintableMap: false,

  // copy/paste of annotations
  // pasteClipboard: { sourceCenter, items: [ item, ... ] }
  //   sourceCenter — { x, y } GROUP bbox center across ALL copied annotations,
  //                  shared transform origin + ghost anchor (preserves relative
  //                  positions and rotates/flips the whole group rigidly).
  //   items[]      — one entry per copied annotation, each:
  //     annotation       — source annotation object (hydrated, with template)
  //     basePoints       — pixel-image points snapshot at Ctrl+C (POLYGON/POLYLINE/STRIP)
  //     baseCuts         — pixel-image cut points snapshot (POLYGON only)
  //     basePoint        — pixel-image single point (POINT/MARKER)
  //     stripWidthPx     — STRIP only
  //     stripOrientation — STRIP only
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
      // Reset the localized-repair override whenever a tool is (re)selected.
      state.repairMode = "AUTO";
      // On quitting a drawing mode, reset the in-progress smartDetect session
      // state so a subsequently relaunched tool starts clean (no inherited
      // detection mode / flags). Persistent option preferences in
      // smartDetectSlice are intentionally kept.
      if (!drawingMode) {
        state.smartDetectEnabled = false;
        state.smartDetectMode = "HOVER";
        state.smartDetectionPresent = false;
        state.globalDetectionRunning = false;
        state.stripDetectionMultiple = false;
      }
    },
    setRepairMode: (state, action) => {
      state.repairMode = action.payload;
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
    setRampWidthM: (state, action) => {
      state.rampWidthM = action.payload;
    },
    setRampDeltaHM: (state, action) => {
      state.rampDeltaHM = action.payload;
    },
    // payload: { strokeWidth, strokeWidthUnit? }
    setOpeningStrokeWidth: (state, action) => {
      const { strokeWidth, strokeWidthUnit } = action.payload ?? {};
      if (strokeWidth != null) state.openingStrokeWidth = strokeWidth;
      if (strokeWidthUnit != null) state.openingStrokeWidthUnit = strokeWidthUnit;
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

    // Image mode
    setImageModeEnabled: (state, action) => {
      state.imageModeEnabled = action.payload;
      if (!action.payload) state.imageModeLegendSelected = false;
    },
    toggleImageModeEnabled: (state) => {
      state.imageModeEnabled = !state.imageModeEnabled;
      if (!state.imageModeEnabled) state.imageModeLegendSelected = false;
    },
    setImageModeLegendSelected: (state, action) => {
      state.imageModeLegendSelected = action.payload;
    },
    setImageModeAspectRatio: (state, action) => {
      state.imageModeAspectRatio = action.payload;
    },
    setImageModeLegendOverlay: (state, action) => {
      state.imageModeLegendOverlay = action.payload;
    },
    setImageModeHighRes: (state, action) => {
      state.imageModeHighRes = action.payload;
    },
    setImageModeShowWatermark: (state, action) => {
      state.imageModeShowWatermark = action.payload;
    },
    setImageModeShowLogo: (state, action) => {
      state.imageModeShowLogo = action.payload;
    },
    setImageModeWhiteBackground: (state, action) => {
      state.imageModeWhiteBackground = action.payload;
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

    // subtraction pick mode
    setSubtractSourceAnnotationId: (state, action) => {
      state.subtractSourceAnnotationId = action.payload;
      state.showLayerScreenCursor = Boolean(action.payload);
    },

    // ortho snap
    setOrthoSnapEnabled: (state, action) => {
      state.orthoSnapEnabled = action.payload;
    },
    setOrthoSnapAngleOffset: (state, action) => {
      state.orthoSnapAngleOffset = action.payload;
    },

    // 2D editor settings
    setVertexSizeMultiplier: (state, action) => {
      state.vertexSizeMultiplier = action.payload;
    },

    // clipping plane (2D-defined cut plane)
    setClippingPlanEnabled: (state, action) => {
      state.clippingPlanEnabled = action.payload;
    },
    setClippingPlan: (state, action) => {
      // partial merge of { pointA, pointB, sign, baseMapId }
      state.clippingPlan = { ...state.clippingPlan, ...action.payload };
    },
    setClippingPlanSign: (state, action) => {
      state.clippingPlan.sign = action.payload;
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
    setSmartDetectMode: (state, action) => {
      state.smartDetectMode = action.payload;
    },
    setGlobalDetectionRunning: (state, action) => {
      state.globalDetectionRunning = action.payload;
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
  setRepairMode,
  setAutoMergeOnCommit,
  setAutoOffsetsOnCommit,
  setAvoidVisibleAnnotationsOnCommit,
  setRampWidthM,
  setRampDeltaHM,
  setOpeningStrokeWidth,
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
  setImageModeEnabled,
  toggleImageModeEnabled,
  setImageModeLegendSelected,
  setImageModeAspectRatio,
  setImageModeLegendOverlay,
  setImageModeHighRes,
  setImageModeShowWatermark,
  setImageModeShowLogo,
  setImageModeWhiteBackground,
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
  setSubtractSourceAnnotationId,

  // ortho snap
  setOrthoSnapEnabled,
  setOrthoSnapAngleOffset,
  setVertexSizeMultiplier,

  // clipping plane
  setClippingPlanEnabled,
  setClippingPlan,
  setClippingPlanSign,

  // strip detection
  setStripDetectionMultiple,

  // smart detect
  setSmartDetectEnabled,
  toggleSmartDetectEnabled,
  setSmartDetectionPresent,
  setSmartDetectMode,
  setGlobalDetectionRunning,

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
