import { createSlice } from "@reduxjs/toolkit";

const popperMapListingsSlice = createSlice({
  name: "popperMapListings",
  initialState: {
    showLayers: false,
    interactionMode: "DRAW", // "DRAW" | "EDIT" | "SELECT"
    collapsed: false,
    showInBaseMapsViewer: false,
  },
  reducers: {
    setShowLayers(state, action) {
      state.showLayers = action.payload;
    },
    setCollapsed(state, action) {
      state.collapsed = action.payload;
    },
    setInteractionMode(state, action) {
      state.interactionMode = action.payload;
    },
    setShowInBaseMapsViewer(state, action) {
      state.showInBaseMapsViewer = action.payload;
    },
  },
});

export const {
  setShowLayers,
  setInteractionMode,
  setCollapsed,
  setShowInBaseMapsViewer,
} = popperMapListingsSlice.actions;

export default popperMapListingsSlice.reducer;
