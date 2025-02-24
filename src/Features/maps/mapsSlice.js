import {createSlice} from "@reduxjs/toolkit";

import demoMap from "./data/demoMap";

const mapsInitialState = {
  //
  mapsMap: {demo: demoMap},
  mapsUpdatedAt: null,
  //
  selectedMapClientId: "demo",
  //
};

export const mapsSlice = createSlice({
  name: "maps",
  initialState: mapsInitialState,
  reducers: {
    setSelectedMapClientId: (state, action) => {
      state.selectedMapClientId = action.payload;
    },
  },
});

export const {
  setSelectedMapClientId,
  //
} = mapsSlice.actions;

export default mapsSlice.reducer;
