import { createSlice } from "@reduxjs/toolkit";

import getInitSelectedModuleKey from "Features/init/services/getInitSelectedModuleKey";
import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";

// Header toggle of the popper / PanelDrawing: "MESHES" (the mailles list,
// Maillage module with the mailles drawer closed, popper only) | "OBJECTS"
// (the objects and listings of a business-objects module, popper only) |
// "CONTENT" (scope content, SCOPE module only) | "ANNOTATIONS" | "PHOTOS"
// (Viewer module with photos) | "BASE_MAPS" (base maps list). The drawing commands live in the
// unified commands toolbar (Features/commandsToolbar). The annotation
// listings of the Dessin module are managed from the expandable panel under
// the active listing band (BandActiveListing), not from a toggle side.
const CONTENT_MODES = [
  "MESHES",
  "OBJECTS",
  "CONTENT",
  "ANNOTATIONS",
  "PHOTOS",
  "BASE_MAPS",
];

const popperMapListingsSlice = createSlice({
  name: "popperMapListings",
  initialState: {
    // "Listes" header of the Dessin popper and docked panel
    // (BandActiveListing):
    // the listings panel is expanded between the active listing band and
    // the templates. In redux so it survives the popper remount between the
    // 2D and 3D editors.
    listingsPanelExpanded: true,
    // "Calques" header of the annotations popper (SectionLayers): the layers
    // list is expanded under the header. In redux for the same reason.
    layersPanelExpanded: true,
    // "Fonds de plan" header of the Dessin popper (SectionPopperBaseMaps,
    // above the listings block): the base maps list is expanded under the
    // header. Collapsed by default; in redux for the same reason.
    baseMapsPanelExpanded: false,
    showLayers: false,
    // null | "DRAW" | "EDIT" | "SELECT" — null = "no mode" (default): the
    // popper behaves like DRAW, and the selected annotation gets EDIT-like
    // tools via the on-map overlay (cote / segment-drag / angle padlock).
    interactionMode: null,
    collapsed: false,
    // Header toggle of the popper and of the docked PanelDrawing:
    // "ANNOTATIONS" | "PHOTOS" (Viewer module with photos) | "BASE_MAPS"
    // (base maps list). In redux (not local state) because the map editor
    // gates the photo pseudo-annotations on it (photos render only while the
    // Photos tab is active) and both surfaces must agree.
    // A page refresh reopening the Maillage module lands on its "Maillage"
    // side, like entering the module does (extraReducers below).
    viewerContentMode:
      getInitSelectedModuleKey() === "MESHES" ? "MESHES" : "ANNOTATIONS",
    // "Fonds de plan" list option (no UI any more, kept for the stored
    // state): relegate the
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
    // "Compact" toggle of the Dessin popper header (ToggleButtonCompact): the
    // popper becomes a legend of the selected base map — every listing at
    // once, narrowed to the listings / groups / templates that have a visible
    // annotation on it, no listing selector. In redux so it survives the
    // popper remount between the 2D and 3D editors.
    compact: false,
    // "Traits de coupe" switch at the bottom of the base maps list: the
    // section marks (BASE_MAP_LINK) are rendered in the Fonds de plan and
    // Dessin modules, 2D and 3D. Arming the section line tool turns it back
    // on (startBaseMapLinkTools).
    showSectionLines: true,
  },
  reducers: {
    setShowSectionLines(state, action) {
      state.showSectionLines = Boolean(action.payload);
    },
    setCompact(state, action) {
      state.compact = Boolean(action.payload);
    },
    setShowLayers(state, action) {
      state.showLayers = action.payload;
    },
    setCollapsed(state, action) {
      state.collapsed = action.payload;
    },
    setInteractionMode(state, action) {
      state.interactionMode = action.payload;
    },
    setViewerContentMode(state, action) {
      state.viewerContentMode = CONTENT_MODES.includes(action.payload)
        ? action.payload
        : "ANNOTATIONS";
    },
    // Detach: the annotations popper falls back to its annotations side.
    // Attach: the legend poppers land on their "Fonds de plan" side, where
    // the list returns; the Dessin popper (no such side) expands its
    // "Fonds de plan" section instead.
    setBaseMapsListDetached(state, action) {
      const detached = Boolean(action.payload);
      state.baseMapsListDetached = detached;
      if (detached && state.viewerContentMode === "BASE_MAPS") {
        state.viewerContentMode = "ANNOTATIONS";
      } else if (!detached) {
        state.viewerContentMode = "BASE_MAPS";
        state.baseMapsPanelExpanded = true;
      }
    },
    setHideEmptyBaseMapsInList(state, action) {
      state.hideEmptyBaseMapsInList = Boolean(action.payload);
    },
    setAutoBaseMapVisibility(state, action) {
      state.autoBaseMapVisibility = Boolean(action.payload);
    },
    setListingsPanelExpanded(state, action) {
      state.listingsPanelExpanded = Boolean(action.payload);
    },
    setLayersPanelExpanded(state, action) {
      state.layersPanelExpanded = Boolean(action.payload);
    },
    setBaseMapsPanelExpanded(state, action) {
      state.baseMapsPanelExpanded = Boolean(action.payload);
    },
  },
  extraReducers: (builder) => {
    // The "Contenu" side exists in the SCOPE module only: the popper lands
    // on the annotations when the module is entered (the content is one tab
    // away), and leaves the "Contenu" side when the module is left (the
    // other modules have no such side).
    // Same rule for the "Objets" side of the business-objects modules.
    builder.addCase("viewers/setSelectedViewerKey", (state, action) => {
      if (action.payload === "SCOPE") state.viewerContentMode = "ANNOTATIONS";
      else if (state.viewerContentMode === "CONTENT")
        state.viewerContentMode = "ANNOTATIONS";
      if (
        state.viewerContentMode === "OBJECTS" &&
        !isBusinessObjectsModuleKey(action.payload)
      )
        state.viewerContentMode = "ANNOTATIONS";
      // "Maillage" side (Maillage module only): the popper lands on it when
      // the module is entered, and leaves it when the module is left.
      if (action.payload === "MESHES") state.viewerContentMode = "MESHES";
      else if (state.viewerContentMode === "MESHES")
        state.viewerContentMode = "ANNOTATIONS";
    });
  },
});

export const {
  setShowLayers,
  setInteractionMode,
  setCollapsed,
  setViewerContentMode,
  setListingsPanelExpanded,
  setLayersPanelExpanded,
  setBaseMapsPanelExpanded,
  setHideEmptyBaseMapsInList,
  setAutoBaseMapVisibility,
  setBaseMapsListDetached,
  setCompact,
  setShowSectionLines,
} = popperMapListingsSlice.actions;

export const selectShowSectionLines = (state) =>
  state.popperMapListings.showSectionLines !== false;

export default popperMapListingsSlice.reducer;
