import { createSlice } from "@reduxjs/toolkit";
import theme from "Styles/theme";

//import demoMarker from "./data/demoMarker";

const markersInitialState = {
  //
  markersMap: {},
  markersUpdatedAt: null,
  //
  selectedMarkerId: null,
  //
  tempMarkerProps: { iconIndex: 1, iconColor: theme.palette.marker.default }, // props used when adding a marker
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
    //
    triggerMarkersUpdate: (state, action) => {
      state.markersUpdatedAt = Date.now();
    },
    //
    setTempMarkerProps: (state, action) => {
      const props = action.payload ?? {};
      state.tempMarkerProps = { ...props, updatedAt: Date.now() };
    },
  },
});

export const {
  setSelectedMarkerId,
  triggerMarkersUpdate,
  //
  createMarker,
  //
  setTempMarkerProps,
} = markersSlice.actions;

export default markersSlice.reducer;
