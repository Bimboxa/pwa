import { createSlice } from "@reduxjs/toolkit";

import demoMap from "./data/demoMap";

const baseMapsInitialState = {
  baseMapsById: null,
  //
  baseMapsMap: { demo: demoMap },
  baseMapsUpdatedAt: null,
  //
};

export const baseMapsSlice = createSlice({
  name: "baseMaps",
  initialState: baseMapsInitialState,
  reducers: {
    setBaseMapsById: (state, action) => {
      const baseMaps = action.payload;
      state.baseMapsById = getItemsByKey(baseMaps, "id");
    },
    //
    triggerBaseMapsUpdate: (state) => {
      state.baseMapsUpdatedAt = Date.now();
    },
    //
  },
});

export const {
  setBaseMapsById,
  //
  setSelectedBaseMapId,
  triggerBaseMapsUpdate,
  //
  createMap,
  updateMap,
} = baseMapsSlice.actions;

export default baseMapsSlice.reducer;
