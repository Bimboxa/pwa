import { createSlice } from "@reduxjs/toolkit";

const threedEditorInitialState = {
  showGrid: true,
  // Forced ON for now: transparent annotations cause flicker / banding
  // artefacts in the photoreal path-tracer, and stochastic alpha doesn't
  // converge cleanly. The toggle is hidden from the UI but the flag is
  // still read by the render pipeline (createAnnotationObject3D) so it can
  // be flipped programmatically if needed.
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
  },
});

export const {
  setShowGrid,
  setDisableOpacity,
  setEditorMode,
  setDrawingOffset,
} = threedEditorSlice.actions;

export default threedEditorSlice.reducer;
