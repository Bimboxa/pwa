import { createSlice } from "@reduxjs/toolkit";

import demoMap from "./data/demoMap";
import setInitSelectedMainBaseMapId from "Features/init/services/setInitSelectedMainBaseMapId";

const baseMapsInitialState = {
  //
  baseMapsMap: { demo: demoMap },
  baseMapsUpdatedAt: null,
  //
};

export const baseMapsSlice = createSlice({
  name: "baseMaps",
  initialState: baseMapsInitialState,
  reducers: {
    //
    triggerMapsUpdate: (state) => {
      state.baseMapsUpdatedAt = Date.now();
    },
    //
    createMap: (state, action) => {
      const map = action.payload;
      state.baseMapsMap[map.id] = map;
    },
    updateMap: (state, action) => {
      const updates = action.payload;
      const map = state.baseMapsMap[updates.id];
      state.baseMapsMap[updates.id] = { ...map, ...updates };
    },
  },
});

export const {
  setselectedBaseMapId,
  triggerMapsUpdate,
  //
  createMap,
  updateMap,
} = baseMapsSlice.actions;

export default baseMapsSlice.reducer;
