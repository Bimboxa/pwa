import { createSlice } from "@reduxjs/toolkit";

const povInitialState = {
  viewerMode: "MAP", // "MAP" | "THREED" — editor shown inside the POINT_OF_VIEW viewer
};

export const povSlice = createSlice({
  name: "pov",
  initialState: povInitialState,
  reducers: {
    setPovViewerMode: (state, action) => {
      state.viewerMode = action.payload;
    },
  },
});

export const { setPovViewerMode } = povSlice.actions;

export default povSlice.reducer;
