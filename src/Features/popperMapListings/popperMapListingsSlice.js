import { createSlice } from "@reduxjs/toolkit";

const popperMapListingsSlice = createSlice({
  name: "popperMapListings",
  initialState: {
    showLayers: false,
    interactionMode: "DRAW", // "DRAW" | "EDIT" | "SELECT"
    collapsed: false,
    showInBaseMapsViewer: false,
    // Viewer module header toggle: "ANNOTATIONS" | "PHOTOS". In redux (not
    // local state) because the map editor gates the photo pseudo-annotations
    // on it (photos render only while the Photos tab is active).
    viewerContentMode: "ANNOTATIONS",
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
    setViewerContentMode(state, action) {
      state.viewerContentMode = action.payload ?? "ANNOTATIONS";
    },
  },
});

export const {
  setShowLayers,
  setInteractionMode,
  setCollapsed,
  setShowInBaseMapsViewer,
  setViewerContentMode,
} = popperMapListingsSlice.actions;

export default popperMapListingsSlice.reducer;
