import { createSlice } from "@reduxjs/toolkit";

import demoMap from "./data/demoMap";

const baseMapsInitialState = {
  baseMapsById: null,
  //
  baseMapsMap: { demo: demoMap },
  baseMapsUpdatedAt: null,
  //
  selectedBaseMapId: null,
  isCreatingBaseMap: false,
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
    setSelectedBaseMapId: (state, action) => {
      state.selectedBaseMapId = action.payload;
    },
    setIsCreatingBaseMap: (state, action) => {
      state.isCreatingBaseMap = action.payload;
    },
    setEditedBaseMap: (state, action) => {
      state.editedBaseMap = action.payload;
    },
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
  //
  setIsCreatingBaseMap,
  setEditedBaseMap,
} = baseMapsSlice.actions;

export default baseMapsSlice.reducer;
