import { createSlice } from "@reduxjs/toolkit";

import { BASE_MAPS_GRID_PHASE } from "./constants/baseMapsGridConstants";

const initialState = {
  // transition state machine, see BASE_MAPS_GRID_PHASE
  phase: BASE_MAPS_GRID_PHASE.CLOSED,
  // base maps listing displayed on the table (tab)
  selectedListingId: null,
  // sheet selected on the table
  selectedBaseMapId: null,
  // Opening in progress that must end on the whole table ("fit all") rather
  // than on the main base map's sheet (SCOPE module landing, see
  // useOpenBaseMapsGrid / LayerBaseMapsGrid). Reset once consumed / closed.
  openFitAll: false,
  // Pinned grid (SCOPE module): the sheets follow the content selection of
  // the scope panel instead of a base maps listing tab — the base maps of
  // the selected folder, or every base map carrying an annotation of the
  // selected listing / of the scope (ScopeGridSheetsController).
  // `addListingId`: listing of the "+" frame (a selected folder only).
  scopeSheets: { baseMapIds: [], addListingId: null, ready: false },
  // Pinned grid: per-sheet image / annotations toggles (the eye and the
  // badge of the "Fonds de plan" rows). Session state, dropped with the
  // scope.
  hiddenImageBaseMapIds: [],
  hiddenAnnotationsBaseMapIds: [],
  // SCOPE module: the grid is wanted (the keepers open it under the
  // displayed editor) from the module entry / a scope change until the user
  // leaves it (double-click on a sheet, G, Escape, close button, nav
  // sprite); opening it again (G, grid button) wants it again.
  scopeGridWanted: true,
  // Bumped by every reducer close of an opened (or opening) grid: the SCOPE
  // keeper (BaseMapsGridPinnedController) depends on it, so an open → close
  // round trip inside one effects pass (open values unchanged in between)
  // still re-runs it.
  closeEpoch: 0,
};

const toggleId = (ids, id) =>
  ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id];

const closeGrid = (state) => {
  if (state.phase !== BASE_MAPS_GRID_PHASE.CLOSED) state.closeEpoch += 1;
  state.phase = BASE_MAPS_GRID_PHASE.CLOSED;
  state.selectedBaseMapId = null;
  state.openFitAll = false;
};

export const baseMapsGridSlice = createSlice({
  name: "baseMapsGrid",
  initialState,
  reducers: {
    setBaseMapsGridPhase: (state, action) => {
      if (action.payload === BASE_MAPS_GRID_PHASE.CLOSED) closeGrid(state);
      else state.phase = action.payload;
      if (
        action.payload === BASE_MAPS_GRID_PHASE.OPENING_ZOOM ||
        action.payload === BASE_MAPS_GRID_PHASE.OPENING_FADE
      ) {
        state.scopeGridWanted = true;
      }
    },
    setBaseMapsGridOpenFitAll: (state, action) => {
      state.openFitAll = Boolean(action.payload);
    },
    setScopeGridWanted: (state, action) => {
      state.scopeGridWanted = Boolean(action.payload);
    },
    setBaseMapsGridListingId: (state, action) => {
      state.selectedListingId = action.payload;
    },
    setBaseMapsGridSelectedBaseMapId: (state, action) => {
      state.selectedBaseMapId = action.payload;
    },
    toggleBaseMapsGridImageHidden: (state, action) => {
      state.hiddenImageBaseMapIds = toggleId(
        state.hiddenImageBaseMapIds,
        action.payload
      );
    },
    toggleBaseMapsGridAnnotationsHidden: (state, action) => {
      state.hiddenAnnotationsBaseMapIds = toggleId(
        state.hiddenAnnotationsBaseMapIds,
        action.payload
      );
    },
    // « Supprimer les filtres » (SCOPE module « Contenu » tab): every sheet
    // shown again (image + annotations), no sheet selected.
    resetBaseMapsGridSheetFilters: (state) => {
      state.hiddenImageBaseMapIds = [];
      state.hiddenAnnotationsBaseMapIds = [];
      state.selectedBaseMapId = null;
    },
    setBaseMapsGridScopeSheets: (state, action) => {
      const {
        baseMapIds = [],
        addListingId = null,
        ready = false,
      } = action.payload ?? {};
      state.scopeSheets = { baseMapIds, addListingId, ready };
    },
  },
  extraReducers: (builder) => {
    // The table belongs to the displayed project / scope / module / editor
    // (a 2D -> 3D toggle unmounts the layer: the phase must not survive it,
    // or the layer would remount already OPEN without its alignment pass).
    // In the SCOPE module the grid is pinned: the keepers re-open it right
    // after any of these (BaseMapsGridPinnedController).
    const closeGridAndResetSheets = (state) => {
      closeGrid(state);
      state.hiddenImageBaseMapIds = [];
      state.hiddenAnnotationsBaseMapIds = [];
      state.scopeGridWanted = true;
    };
    builder
      .addCase("scopes/setSelectedScopeId", closeGridAndResetSheets)
      .addCase("projects/setSelectedProjectId", closeGridAndResetSheets)
      .addCase("viewers/setSelectedViewerKey", (state, action) => {
        closeGrid(state);
        // entering the SCOPE module: its grid is the landing state
        if (action.payload === "SCOPE") state.scopeGridWanted = true;
      })
      .addCase("viewers/setModuleEditorKey", closeGrid)
      // the 3D grid opened (G, button, keeper): wanted again
      .addCase("threedEditor/setBaseMapsGridModeActive", (state, action) => {
        if (action.payload) state.scopeGridWanted = true;
      });
  },
});

export const {
  setBaseMapsGridPhase,
  setBaseMapsGridListingId,
  setBaseMapsGridSelectedBaseMapId,
  setBaseMapsGridScopeSheets,
  setScopeGridWanted,
  setBaseMapsGridOpenFitAll,
  toggleBaseMapsGridImageHidden,
  toggleBaseMapsGridAnnotationsHidden,
  resetBaseMapsGridSheetFilters,
} = baseMapsGridSlice.actions;

export const selectBaseMapsGridOpen = (s) =>
  s.baseMapsGrid.phase !== BASE_MAPS_GRID_PHASE.CLOSED;

// The grid layer is mounted (covering the editor) from the fade-in on.
export const selectBaseMapsGridMounted = (s) =>
  s.baseMapsGrid.phase !== BASE_MAPS_GRID_PHASE.CLOSED &&
  s.baseMapsGrid.phase !== BASE_MAPS_GRID_PHASE.OPENING_ZOOM;

export default baseMapsGridSlice.reducer;
