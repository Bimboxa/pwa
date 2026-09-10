import { createSlice } from "@reduxjs/toolkit";

// "SELECTOR" (LISTE ACTIVE field) | "AVATARS" (listing avatars band).
const LISTING_SELECTOR_MODES = ["SELECTOR", "AVATARS"];

const popperMapListingsSlice = createSlice({
  name: "popperMapListings",
  initialState: {
    listingSelectorMode: "AVATARS",
    showLayers: false,
    // null | "DRAW" | "EDIT" | "SELECT" — null = "no mode" (default): the
    // popper behaves like DRAW, and the selected annotation gets EDIT-like
    // tools via the on-map overlay (cote / segment-drag / angle padlock).
    interactionMode: null,
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
    setListingSelectorMode(state, action) {
      state.listingSelectorMode = LISTING_SELECTOR_MODES.includes(
        action.payload
      )
        ? action.payload
        : "AVATARS";
    },
  },
});

export const {
  setShowLayers,
  setInteractionMode,
  setCollapsed,
  setShowInBaseMapsViewer,
  setViewerContentMode,
  setListingSelectorMode,
} = popperMapListingsSlice.actions;

export default popperMapListingsSlice.reducer;
