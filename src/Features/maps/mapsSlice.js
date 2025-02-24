import {createSlice} from "@reduxjs/toolkit";

import demoMap from "./data/demoMap";

const mapsInitialState = {
  //
  mapsMap: {demo: demoMap},
  mapsUpdatedAt: null,
  //
  selectedMapId: null,
  //
};

export const mapsSlice = createSlice({
  name: "maps",
  initialState: mapsInitialState,
  reducers: {
    setSelectedMapId: (state, action) => {
      state.selectedMapId = action.payload;
    },
  },
});

export const {
  setSelectedMapId,
  //
} = mapsSlice.actions;

export default mapsSlice.reducer;
