import { createSlice } from "@reduxjs/toolkit";

import { grey } from "@mui/material/colors";

const smartDetectInitialState = {
  //
  centerColor: grey[500],
  noCuts: true,
  noSmallCuts: true,
  convexHull: false,
  visibleAreaOnly: true,
};

export const smartDetectSlice = createSlice({
  name: "smartDetect",
  initialState: smartDetectInitialState,
  reducers: {
    setCenterColor: (state, action) => {
      state.centerColor = action.payload;
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
  },
});

export const {
  setCenterColor,
  setNoCuts,
  setNoSmallCuts,
  setConvexHull,
  setVisibleAreaOnly,
} = smartDetectSlice.actions;

export default smartDetectSlice.reducer;
