import { createSlice } from "@reduxjs/toolkit";

const popperMapListingsSlice = createSlice({
  name: "popperMapListings",
  initialState: {
    showLayers: false,
    soloMode: false,
    soloVisibleTemplateIds: null,
    soloListingId: null,
  },
  reducers: {
    setShowLayers(state, action) {
      state.showLayers = action.payload;
    },
    setSoloMode(state, action) {
      state.soloMode = action.payload;
      if (!action.payload) {
        state.soloVisibleTemplateIds = null;
        state.soloListingId = null;
      }
    },
    setSoloVisibleTemplateIds(state, action) {
      state.soloVisibleTemplateIds = action.payload;
    },
    setSoloListingId(state, action) {
      state.soloListingId = action.payload;
    },
  },
});

export const {
  setShowLayers,
  setSoloMode,
  setSoloVisibleTemplateIds,
  setSoloListingId,
} = popperMapListingsSlice.actions;

export default popperMapListingsSlice.reducer;
