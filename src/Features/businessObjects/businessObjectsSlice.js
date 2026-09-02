import { createSlice } from "@reduxjs/toolkit";

import { setSelectedViewerKey } from "Features/viewers/viewersSlice";

const businessObjectsInitialState = {
  // db trigger ticks
  businessObjectsUpdatedAt: null,
  relsUpdatedAt: null,
  // drawer state — own listing selection (s.listings.selectedListingId is the
  // Dessin module's active listing and must not be reused here).
  selectedListingId: null,
  // Selected object = SOLO filter: useAnnotationsV2 shows only the
  // annotations linked to it (descendants included) while set. It survives
  // map selections (a click on a linked annotation must not unhide the rest)
  // and clears on module switch / toggle re-click / object deletion.
  selectedBusinessObjectId: null,
  collapsedIds: [],
  // picking mode: business object armed for link/unlink clicks on the map
  linkingBusinessObjectId: null,
};

export const businessObjectsSlice = createSlice({
  name: "businessObjects",
  initialState: businessObjectsInitialState,
  reducers: {
    triggerBusinessObjectsUpdate: (state) => {
      state.businessObjectsUpdatedAt = Date.now();
    },
    triggerRelsBusinessObjectAnnotationUpdate: (state) => {
      state.relsUpdatedAt = Date.now();
    },
    //
    setSelectedListingId: (state, action) => {
      state.selectedListingId = action.payload;
    },
    setSelectedBusinessObjectId: (state, action) => {
      state.selectedBusinessObjectId = action.payload;
    },
    toggleBusinessObjectCollapsed: (state, action) => {
      const id = action.payload;
      if (state.collapsedIds.includes(id)) {
        state.collapsedIds = state.collapsedIds.filter((i) => i !== id);
      } else {
        state.collapsedIds.push(id);
      }
    },
    setLinkingBusinessObjectId: (state, action) => {
      state.linkingBusinessObjectId = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Leaving the BUSINESS_OBJECTS module clears the object selection and the
    // picking mode. Keyed on the MODULE switch (not on a viewer unmount): the
    // 2D↔3D editor toggle (T) unmounts the 2D viewer while the module stays
    // selected, and the state must survive it.
    builder.addCase(setSelectedViewerKey, (state, action) => {
      if (action.payload !== "BUSINESS_OBJECTS") {
        state.selectedBusinessObjectId = null;
        state.linkingBusinessObjectId = null;
      }
    });
  },
});

export const {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
  setSelectedListingId,
  setSelectedBusinessObjectId,
  toggleBusinessObjectCollapsed,
  setLinkingBusinessObjectId,
} = businessObjectsSlice.actions;

export default businessObjectsSlice.reducer;
