import { createSlice } from "@reduxjs/toolkit";

const threedEditorInitialState = {
  showGrid: true,
  // Forced ON for now: transparent annotations cause flicker / banding
  // artefacts in the photoreal path-tracer, and stochastic alpha doesn't
  // converge cleanly. The toggle is hidden from the UI but the flag is
  // still read by the render pipeline (createAnnotationObject3D) so it can
  // be flipped programmatically if needed.
  disableOpacity: true,
  // "NAVIGATION" | "SELECTION" — disambiguates shift+drag between
  // camera control (NAVIGATION) and lasso selection (SELECTION).
  editorMode: "NAVIGATION",
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
  },
});

export const { setShowGrid, setDisableOpacity, setEditorMode } =
  threedEditorSlice.actions;

export default threedEditorSlice.reducer;
