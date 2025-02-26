import {createSlice} from "@reduxjs/toolkit";

import demoMarker from "./data/demoMarker";

const markersInitialState = {
  //
  markersMap: {demo: demoMarker},
  markersUpdatedAt: null,
  //
  selectedMarkerId: null,
  //
};

export const markersSlice = createSlice({
  name: "markers",
  initialState: markersInitialState,
  reducers: {
    setSelectedMarkerId: (state, action) => {
      state.selectedMarkerId = action.payload;
    },
    //
    createMarker: (state, action) => {
      const marker = action.payload;
      state.markersMap[marker.id] = marker;
      state.markersUpdatedAt = Date.now();
    },
  },
});

export const {
  setSelectedMarkerId,
  //
  createMarker,
} = markersSlice.actions;

export default markersSlice.reducer;
