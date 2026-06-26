import { createSlice } from "@reduxjs/toolkit";

const urlParamsSlice = createSlice({
  name: "urlParams",
  initialState: {
    viewerMode: false, // locked "viewer" UI mode driven by ?mode=viewer
  },
  reducers: {
    setViewerMode(state, action) {
      state.viewerMode = action.payload;
    },
  },
});

export const { setViewerMode } = urlParamsSlice.actions;

export default urlParamsSlice.reducer;
