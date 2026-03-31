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
} = smartDetectSlice.actions;

export default smartDetectSlice.reducer;
