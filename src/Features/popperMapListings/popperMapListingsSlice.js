import { createSlice } from "@reduxjs/toolkit";

import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";

// "SELECTOR" (LISTE ACTIVE field) | "AVATARS" (listing avatars band).
const LISTING_SELECTOR_MODES = ["SELECTOR", "AVATARS"];

// Header toggle of the popper / PanelDrawing: "OBJECTS" (the objects and
// listings of a business-objects module, popper only) | "CONTENT" (scope
// content, SCOPE module only) | "LISTINGS" ("Listes": the annotation
// listings of the Dessin module, popper only) | "ANNOTATIONS" | "PHOTOS"
// (Viewer module with photos) | "BASE_MAPS" (base maps list) | "TOOLS"
// ("Commandes": the drawing tools, popper only, while they are attached).
const CONTENT_MODES = [
  "OBJECTS",
  "CONTENT",
  "LISTINGS",
  "ANNOTATIONS",
  "PHOTOS",
  "BASE_MAPS",
  "TOOLS",
];

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
    // "Visibilité auto" option of the base maps list: selecting a base map
    // as main hides the image / annotations of every other base map in the
    // displayed editor (useHideOtherBaseMaps).
    autoBaseMapVisibility: false,
    // "Détacher la liste" (icon of the "Fonds de plan" title row): the base
    // maps list lives in its own popper (PopperBaseMapsList) instead of the
    // "Fonds de plan" side of the annotations popper, which then has no such
    // side.
    baseMapsListDetached: false,
    // "Détacher les commandes": the module's commands live in their own
    // popper (PopperDrawingTools, under the annotations popper by default)
    // instead of the "Commandes" side of the annotations popper (drawing
    // tools) — or, in the BaseMaps module, instead of the "Commandes" section
    // under the base maps list (Déplacer / Tourner the base map). Detached by
    // default.
    toolsDetached: true,
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
    // Detach: the annotations popper falls back to its annotations side.
    // Attach: it lands on the "Fonds de plan" side, where the list returns.
    setBaseMapsListDetached(state, action) {
      const detached = Boolean(action.payload);
      state.baseMapsListDetached = detached;
      if (detached && state.viewerContentMode === "BASE_MAPS") {
        state.viewerContentMode = "ANNOTATIONS";
      } else if (!detached) {
        state.viewerContentMode = "BASE_MAPS";
      }
    },
    // Same rule for the drawing tools ("Commandes" side).
    setToolsDetached(state, action) {
      const detached = Boolean(action.payload);
      state.toolsDetached = detached;
      if (detached && state.viewerContentMode === "TOOLS") {
        state.viewerContentMode = "ANNOTATIONS";
      } else if (!detached) {
        state.viewerContentMode = "TOOLS";
      }
    },
    setHideEmptyBaseMapsInList(state, action) {
      state.hideEmptyBaseMapsInList = Boolean(action.payload);
    },
    setAutoBaseMapVisibility(state, action) {
      state.autoBaseMapVisibility = Boolean(action.payload);
    },
    setListingSelectorMode(state, action) {
      state.listingSelectorMode = LISTING_SELECTOR_MODES.includes(
        action.payload
      )
        ? action.payload
        : "AVATARS";
    },
  },
  extraReducers: (builder) => {
    // The "Contenu" side exists in the SCOPE module only: the popper lands
    // on the annotations when the module is entered (the content is one tab
    // away), and leaves the "Contenu" side when the module is left (the
    // other modules have no such side).
    // Same rule for the "Objets" side of the business-objects modules and
    // for the "Listes" side of the Dessin module.
    builder.addCase("viewers/setSelectedViewerKey", (state, action) => {
      if (action.payload === "SCOPE") state.viewerContentMode = "ANNOTATIONS";
      else if (state.viewerContentMode === "CONTENT")
        state.viewerContentMode = "ANNOTATIONS";
      if (state.viewerContentMode === "LISTINGS" && action.payload !== "MAP")
        state.viewerContentMode = "ANNOTATIONS";
      if (
        state.viewerContentMode === "OBJECTS" &&
        !isBusinessObjectsModuleKey(action.payload)
      )
        state.viewerContentMode = "ANNOTATIONS";
    });
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
  setAutoBaseMapVisibility,
  setBaseMapsListDetached,
  setToolsDetached,
} = popperMapListingsSlice.actions;

export default popperMapListingsSlice.reducer;
