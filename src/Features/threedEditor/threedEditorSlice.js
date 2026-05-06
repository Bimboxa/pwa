import { createSlice } from "@reduxjs/toolkit";

const threedEditorInitialState = {
  showGrid: true,
  // When true, annotation materials ignore `annotation.opacity` and render
  // fully opaque. Exposed as the "Transparence des annotations" switch.
  disableOpacity: true,
  // "NAVIGATION" | "SELECTION" | "BASEMAP_POSITION".
  // - NAVIGATION: shift+drag = camera (OrbitControls).
  // - SELECTION: shift+drag = lasso selection.
  // - BASEMAP_POSITION: shows the position/rotation panel + transform gizmo
  //   for the selected basemap. Annotation creation and lasso are blocked.
  editorMode: "NAVIGATION",
  // Vertical offset (in meters along the basemap's local normal) applied to
  // newly drawn annotations. Set from the basemap-position panel; consumed
  // by the annotation creation flow so a user can stack new annotations
  // above the floor without a per-annotation offsetZ tweak.
  drawingOffset: 0,
  // 3D-only basemap opacity (0..1). Independent from baseMap.opacity (DB)
  // and from mapEditor.baseMapOpacity (2D). Resets to 1 on every reload.
  baseMapOpacityIn3d: 1,
};

export const threedEditorSlice = createSlice({
  name: "threedEditor",
  initialState: threedEditorInitialState,
  reducers: {
    setShowGrid: (state, action) => {
      state.showGrid = action.payload;
    },
    setDisableOpacity: (state, action) => {
      state.disableOpacity = action.payload;
    },
    setEditorMode: (state, action) => {
      state.editorMode = action.payload;
    },
    setDrawingOffset: (state, action) => {
      state.drawingOffset = action.payload;
    },
    setBaseMapOpacityIn3d: (state, action) => {
      state.baseMapOpacityIn3d = action.payload;
    },
  },
});

export const {
  setShowGrid,
  setDisableOpacity,
  setEditorMode,
  setDrawingOffset,
  setBaseMapOpacityIn3d,
} = threedEditorSlice.actions;

export default threedEditorSlice.reducer;
