import { createSlice } from "@reduxjs/toolkit";

import { grey } from "@mui/material/colors";

const smartDetectInitialState = {
  //
  centerColor: grey[500],
  rawDetection: false,
  noCuts: false,
  noSmallCuts: true,
  convexHull: false,
  // When true, the SURFACE_DROP flood fill ignores the base map image content
  // and runs on an all-white binary, so it is bounded only by existing
  // annotation footprints (and the viewport ROI).
  ignoreBaseMap: false,
  // When true, the SURFACE_DROP tool ("goutte d'eau") ignores the OpenCV
  // image flood fill on click and instead runs the annotation-geometry
  // detection (detectPolygonFromAnnotations), building the polygon from the
  // contours formed by the surrounding annotations — same algorithm as the
  // POLYGON_CLICK hover smart-detect (S key).
  useOutlines: false,
  visibleAreaOnly: true,
  //
  simplifyPolynomial: true,
  simplifyOuterContour: false,
  //
  // When true (default), pressing Space to commit detected strips runs
  // cleanSegments on (detected strips + visible 2-point POLYLINEs) before
  // persisting. See docs/smartDetect/CLEAN_ON_COMMIT.md.
  cleanOnCommit: true,
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
    setIgnoreBaseMap: (state, action) => {
      state.ignoreBaseMap = action.payload;
    },
    setUseOutlines: (state, action) => {
      state.useOutlines = action.payload;
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
  },
});

export const {
  setCenterColor,
  setRawDetection,
  setNoCuts,
  setNoSmallCuts,
  setConvexHull,
  setIgnoreBaseMap,
  setUseOutlines,
  setVisibleAreaOnly,
  setSimplifyPolynomial,
  setSimplifyOuterContour,
  setCleanOnCommit,
} = smartDetectSlice.actions;

export default smartDetectSlice.reducer;
