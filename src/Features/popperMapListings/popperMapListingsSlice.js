import { createSlice } from "@reduxjs/toolkit";

// "SELECTOR" (LISTE ACTIVE field) | "AVATARS" (listing avatars band).
const LISTING_SELECTOR_MODES = ["SELECTOR", "AVATARS"];

// Header toggle of the popper / PanelDrawing: "ANNOTATIONS" | "PHOTOS" (Viewer
// module with photos) | "BASE_MAPS" (base maps list).
const CONTENT_MODES = ["ANNOTATIONS", "PHOTOS", "BASE_MAPS"];

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
    // Header toggle of the popper and of the docked PanelDrawing:
    // "ANNOTATIONS" | "PHOTOS" (Viewer module with photos) | "BASE_MAPS"
    // (base maps list). In redux (not local state) because the map editor
    // gates the photo pseudo-annotations on it (photos render only while the
    // Photos tab is active) and both surfaces must agree.
    viewerContentMode: "ANNOTATIONS",
    // "Fonds de plan" list option (PanelPropertiesBaseMapsList): relegate the
    // base maps without annotations — except the main one and those whose
    // image / annotations are currently shown in 3D.
    hideEmptyBaseMapsInList: false,
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
      state.viewerContentMode = CONTENT_MODES.includes(action.payload)
        ? action.payload
        : "ANNOTATIONS";
    },
    setHideEmptyBaseMapsInList(state, action) {
      state.hideEmptyBaseMapsInList = Boolean(action.payload);
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
  setHideEmptyBaseMapsInList,
} = popperMapListingsSlice.actions;

export default popperMapListingsSlice.reducer;
