import { createSlice } from "@reduxjs/toolkit";

import { setSelectedViewerKey } from "Features/viewers/viewersSlice";

const zoningsInitialState = {
  // db trigger ticks
  zonesUpdatedAt: null,
  relsUpdatedAt: null,
  // drawer state
  collapsedListingIds: [],
  collapsedZoneIds: [],
  selectedZoneId: null,
  // {zoneId, listingId, templateId} | null — zone SOLO filter
  soloZone: null,
};

export const zoningsSlice = createSlice({
  name: "zonings",
  initialState: zoningsInitialState,
  reducers: {
    triggerZonesUpdate: (state) => {
      state.zonesUpdatedAt = Date.now();
    },
    triggerRelsZoneAnnotationUpdate: (state) => {
      state.relsUpdatedAt = Date.now();
    },
    //
    toggleListingCollapsed: (state, action) => {
      const listingId = action.payload;
      if (state.collapsedListingIds.includes(listingId)) {
        state.collapsedListingIds = state.collapsedListingIds.filter(
          (id) => id !== listingId
        );
      } else {
        state.collapsedListingIds.push(listingId);
      }
    },
    toggleZoneCollapsed: (state, action) => {
      const zoneId = action.payload;
      if (state.collapsedZoneIds.includes(zoneId)) {
        state.collapsedZoneIds = state.collapsedZoneIds.filter(
          (id) => id !== zoneId
        );
      } else {
        state.collapsedZoneIds.push(zoneId);
      }
    },
    setSelectedZoneId: (state, action) => {
      state.selectedZoneId = action.payload;
    },
    setSoloZone: (state, action) => {
      state.soloZone = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Leaving the ZONES module clears the zone solo & selection. Keyed on the
    // MODULE switch (not on a viewer unmount): the 2D↔3D editor toggle (T)
    // unmounts the 2D viewer while the module stays selected, and the solo
    // must survive it.
    builder.addCase(setSelectedViewerKey, (state, action) => {
      if (action.payload !== "ZONES") {
        state.soloZone = null;
        state.selectedZoneId = null;
      }
    });
  },
});

export const {
  triggerZonesUpdate,
  triggerRelsZoneAnnotationUpdate,
  toggleListingCollapsed,
  toggleZoneCollapsed,
  setSelectedZoneId,
  setSoloZone,
} = zoningsSlice.actions;

export default zoningsSlice.reducer;
