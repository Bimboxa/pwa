import { createSlice } from "@reduxjs/toolkit";

const popperMapListingsSlice = createSlice({
  name: "popperMapListings",
  initialState: {
    showLayers: false,
    soloMode: false,
    soloVisibleTemplateIds: null,
    soloListingId: null,
    interactionMode: "DRAW", // "DRAW" | "EDIT" | "SELECT"
    // "Maillage": when true, meshed parents are replaced by their mesh cells on
    // the 2D map and interactions behave like "SELECT" (see MainMapEditorV3 /
    // InteractionLayer). Mirrors threedEditor.showMeshCells.
    showMeshCells: false,
    collapsed: false,
  },
  reducers: {
    setShowLayers(state, action) {
      state.showLayers = action.payload;
    },
    setCollapsed(state, action) {
      state.collapsed = action.payload;
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
    setInteractionMode(state, action) {
      state.interactionMode = action.payload;
    },
    setShowMeshCells(state, action) {
      state.showMeshCells = action.payload;
    },
  },
});

export const {
  setShowLayers,
  setSoloMode,
  setSoloVisibleTemplateIds,
  setSoloListingId,
  setInteractionMode,
  setShowMeshCells,
  setCollapsed,
} = popperMapListingsSlice.actions;

export default popperMapListingsSlice.reducer;
