import {createSlice} from "@reduxjs/toolkit";

import demoMap from "./data/demoMap";
import setInitMapId from "Features/init/services/setInitMapId";

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
      const mapId = action.payload;
      state.selectedMapId = action.payload;
      setInitMapId(mapId);
    },
    //
    triggerMapsUpdate: (state) => {
      state.mapsUpdatedAt = Date.now();
    },
    //
    createMap: (state, action) => {
      const map = action.payload;
      state.mapsMap[map.id] = map;
    },
    updateMap: (state, action) => {
      const updates = action.payload;
      const map = state.mapsMap[updates.id];
      state.mapsMap[updates.id] = {...map, ...updates};
    },
  },
});

export const {
  setSelectedMapId,
  triggerMapsUpdate,
  //
  createMap,
  updateMap,
} = mapsSlice.actions;

export default mapsSlice.reducer;
