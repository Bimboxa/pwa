import { createSlice } from "@reduxjs/toolkit";

import { grey } from "@mui/material/colors";

const smartDetectInitialState = {
  //
  centerColor: grey[500],
  rawDetection: false,
  noCuts: false,
  noSmallCuts: true,
  convexHull: false,
  visibleAreaOnly: true,
  //
  simplifyPolynomial: true,
  simplifyOuterContour: false,
  //
  // When true (default), pressing Space to commit detected strips runs
  // cleanSegments on (detected strips + visible 2-point POLYLINEs) before
  // persisting. See docs/smartDetect/CLEAN_ON_COMMIT.md.
  cleanOnCommit: true,
  //
  // SURFACE_DROP smartDetect mode (loupe-bounded flood-fill).
  // Pixel is considered a barrier when (r+g+b)/3 < surfaceDropDarknessThreshold.
  surfaceDropDarknessThreshold: 100,
  // Live preview polygon tracked on mouse move; committed on click.
  // Shape: { points: [{x, y}], cuts?: [{points: [{x,y}]}] } in local map coords,
  // or null when no preview is active.
  surfaceDropPreview: null,
};

export const smartDetectSlice = createSlice({
  name: "smartDetect",
  initialState: smartDetectInitialState,
  reducers: {
    setCenterColor: (state, action) => {
      state.centerColor = action.payload;
    },
    setRawDetection: (state, action) => {
      state.rawDetection = action.payload;
    },
    setNoCuts: (state, action) => {
      state.noCuts = action.payload;
    },
    setNoSmallCuts: (state, action) => {
      state.noSmallCuts = action.payload;
    },
    setConvexHull: (state, action) => {
      state.convexHull = action.payload;
    },
    setVisibleAreaOnly: (state, action) => {
      state.visibleAreaOnly = action.payload;
    },
    setSimplifyPolynomial: (state, action) => {
      state.simplifyPolynomial = action.payload;
    },
    setSimplifyOuterContour: (state, action) => {
      state.simplifyOuterContour = action.payload;
    },
    setCleanOnCommit: (state, action) => {
      state.cleanOnCommit = action.payload;
    },
    setSurfaceDropDarknessThreshold: (state, action) => {
      state.surfaceDropDarknessThreshold = action.payload;
    },
    setSurfaceDropPreview: (state, action) => {
      state.surfaceDropPreview = action.payload;
    },
  },
});

export const {
  setCenterColor,
  setRawDetection,
  setNoCuts,
  setNoSmallCuts,
  setConvexHull,
  setVisibleAreaOnly,
  setSimplifyPolynomial,
  setSimplifyOuterContour,
  setCleanOnCommit,
  setSurfaceDropDarknessThreshold,
  setSurfaceDropPreview,
} = smartDetectSlice.actions;

export default smartDetectSlice.reducer;
