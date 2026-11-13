import { createSlice } from "@reduxjs/toolkit";

// « + fond de plan » command of a section mark (BASE_MAP_LINK source): a
// vertical page — a new blank page ("BLANK") or an existing vertical base
// map ("EXISTING") — is previewed in the 3D editor inside a fluo green
// frame, slid by drag and drop in the vertical plane of the mark, and
// created / posed on Space (useSectionBaseMapPlacement).
//
// Redux holds the parameters shown in the drawing helper; the live pose of
// the drag lives in sectionBaseMapPlacementStore (no render per move).
export const SECTION_BASE_MAP_MODES = { BLANK: "BLANK", EXISTING: "EXISTING" };

const initialState = {
  active: false,
  // the SOURCE section mark the page is created for
  sourceAnnotationId: null,
  mode: SECTION_BASE_MAP_MODES.BLANK,
  // blank page parameters (same as DialogCreateBlankBaseMap)
  name: "",
  format: "paysage",
  size: "A3",
  scale: 50,
  // null = default folder (resolved by the helper / the commit)
  listingId: null,
  // existing vertical base map
  existingBaseMapId: null,
};

const sectionBaseMapPlacementSlice = createSlice({
  name: "sectionBaseMapPlacement",
  initialState,
  reducers: {
    startSectionBaseMapPlacement(state, action) {
      const { sourceAnnotationId, name } = action.payload ?? {};
      if (!sourceAnnotationId) return;
      // format / size / scale / folder: kept from the previous run
      state.active = true;
      state.sourceAnnotationId = sourceAnnotationId;
      state.mode = SECTION_BASE_MAP_MODES.BLANK;
      state.name = name ?? "";
      state.existingBaseMapId = null;
    },
    stopSectionBaseMapPlacement(state) {
      state.active = false;
      state.sourceAnnotationId = null;
      state.existingBaseMapId = null;
    },
    setSectionBaseMapPlacementParams(state, action) {
      const params = action.payload ?? {};
      [
        "mode",
        "name",
        "format",
        "size",
        "scale",
        "listingId",
        "existingBaseMapId",
      ].forEach((key) => {
        if (params[key] !== undefined) state[key] = params[key];
      });
    },
  },
  extraReducers: (builder) => {
    // The placement never survives a change of main base map, scope, project,
    // module or 2D / 3D editor, nor another tool being armed (a 2D draw, or
    // any 3D tool mode). Matched by type string: no slice import cycle.
    builder.addMatcher(
      (action) =>
        action.type === "mapEditors/setSelectedMainBaseMapId" ||
        action.type === "scopes/setSelectedScopeId" ||
        action.type === "projects/setSelectedProjectId" ||
        action.type === "viewers/setSelectedViewerKey" ||
        action.type === "viewers/setModuleEditorKey" ||
        (action.type === "mapEditors/setEnabledDrawingMode" &&
          Boolean(action.payload)) ||
        (typeof action.type === "string" &&
          action.type.startsWith("threedEditor/set") &&
          action.type.endsWith("ModeActive") &&
          Boolean(action.payload)),
      (state) => {
        state.active = false;
        state.sourceAnnotationId = null;
        state.existingBaseMapId = null;
      }
    );
  },
});

export const {
  startSectionBaseMapPlacement,
  stopSectionBaseMapPlacement,
  setSectionBaseMapPlacementParams,
} = sectionBaseMapPlacementSlice.actions;

export const selectSectionBaseMapPlacement = (s) => s.sectionBaseMapPlacement;
export const selectIsSectionBaseMapPlacementActive = (s) =>
  Boolean(s.sectionBaseMapPlacement?.active);

export default sectionBaseMapPlacementSlice.reducer;
