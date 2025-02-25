import {createSlice} from "@reduxjs/toolkit";

import demoMap from "./data/demoMap";

const mapsInitialState = {
  //
  mapsMap: {demo: demoMap},
  mapsUpdatedAt: null,
  //
  selectedMapId: "demo",
  //
};

export const mapsSlice = createSlice({
  name: "maps",
  initialState: mapsInitialState,
  reducers: {
    setSelectedMapId: (state, action) => {
      state.selectedMapId = action.payload;
    },
    //
    updateMap: (state, action) => {
      const updates = action.payload;
      const map = state.mapsMap[updates.id];
      state.mapsMap[updates.id] = {...map, ...updates};
    },
  },
});

export const {
  setSelectedMapId,
  //
  updateMap,
} = mapsSlice.actions;

export default mapsSlice.reducer;
