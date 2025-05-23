import {createSlice} from "@reduxjs/toolkit";

//import demoMarker from "./data/demoMarker";

const markersInitialState = {
  //
  markersMap: {},
  markersUpdatedAt: null,
  //
  selectedMarkerId: null,
  //
  tempMarker: null,
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
    //
    triggerMarkersUpdate: (state, action) => {
      state.markersUpdatedAt = Date.now();
    },
    //
    setTempMarker: (state, action) => {
      state.tempMarker = action.payload;
    },
  },
});

export const {
  setSelectedMarkerId,
  triggerMarkersUpdate,
  //
  createMarker,
  //
  setTempMarker,
} = markersSlice.actions;

export default markersSlice.reducer;
