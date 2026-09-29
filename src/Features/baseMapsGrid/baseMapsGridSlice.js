import { createSlice } from "@reduxjs/toolkit";

import {
  BASE_MAPS_GRID_IMAGE_MODE,
  BASE_MAPS_GRID_PHASE,
} from "./constants/baseMapsGridConstants";

const initialState = {
  // transition state machine, see BASE_MAPS_GRID_PHASE
  phase: BASE_MAPS_GRID_PHASE.CLOSED,
  // base maps listing displayed on the table (tab)
  selectedListingId: null,
  // sheet selected on the table
  selectedBaseMapId: null,
  // display of the base map images on the sheets (kept across openings)
  imageMode: BASE_MAPS_GRID_IMAGE_MODE.FULL,
};

const closeGrid = (state) => {
  state.phase = BASE_MAPS_GRID_PHASE.CLOSED;
  state.selectedBaseMapId = null;
};

export const baseMapsGridSlice = createSlice({
  name: "baseMapsGrid",
  initialState,
  reducers: {
    setBaseMapsGridPhase: (state, action) => {
      state.phase = action.payload;
      if (action.payload === BASE_MAPS_GRID_PHASE.CLOSED) {
        state.selectedBaseMapId = null;
      }
    },
    setBaseMapsGridListingId: (state, action) => {
      state.selectedListingId = action.payload;
    },
    setBaseMapsGridSelectedBaseMapId: (state, action) => {
      state.selectedBaseMapId = action.payload;
    },
    setBaseMapsGridImageMode: (state, action) => {
      state.imageMode = action.payload;
    },
  },
  extraReducers: (builder) => {
    // The table belongs to the displayed project / scope / module.
    builder
      .addCase("scopes/setSelectedScopeId", closeGrid)
      .addCase("projects/setSelectedProjectId", closeGrid)
      .addCase("viewers/setSelectedViewerKey", closeGrid);
  },
});

export const {
  setBaseMapsGridPhase,
  setBaseMapsGridListingId,
  setBaseMapsGridSelectedBaseMapId,
  setBaseMapsGridImageMode,
} = baseMapsGridSlice.actions;

export const selectBaseMapsGridOpen = (s) =>
  s.baseMapsGrid.phase !== BASE_MAPS_GRID_PHASE.CLOSED;

// The grid layer is mounted (covering the editor) from the fade-in on.
export const selectBaseMapsGridMounted = (s) =>
  s.baseMapsGrid.phase !== BASE_MAPS_GRID_PHASE.CLOSED &&
  s.baseMapsGrid.phase !== BASE_MAPS_GRID_PHASE.OPENING_ZOOM;

export default baseMapsGridSlice.reducer;
