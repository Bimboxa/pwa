import { createSlice } from "@reduxjs/toolkit";

import { setSelectedViewerKey } from "Features/viewers/viewersSlice";

const businessObjectsInitialState = {
  // db trigger ticks
  businessObjectsUpdatedAt: null,
  relsUpdatedAt: null,
  workPackagesUpdatedAt: null,
  relsWorkPackageUpdatedAt: null,
  // PLANNING module panel tab: "WORK_STATIONS" (tasks tree) |
  // "WORK_PACKAGES" (work packages list).
  panelTabKey: "WORK_STATIONS",
  // drawer state — own listing selection (s.listings.selectedListingId is the
  // Dessin module's active listing and must not be reused here).
  selectedListingId: null,
  // ACTIVE object = the one the module works on. Set by the row click
  // alongside the {type: "BUSINESS_OBJECT"} selection, but PERSISTENT where
  // the selection is not: it survives the map selections that drawing an
  // annotation produces, so the popper stays in "Localisation" mode and the
  // LOCATE_BUSINESS_OBJECT interceptor still knows its target while the user
  // locates the object on several base maps in a row. Cleared on module
  // switch / listing switch / object deletion.
  activeBusinessObjectId: null,
  // Active work package (PLANNING module): same contract, and the Gantt's
  // target when creating slots. Mutually exclusive with the active object.
  activeWorkPackageId: null,
  // SOLO filters (display only, zonings.soloZone pattern): useAnnotationsV2
  // shows only the annotations linked to the soloed object (descendants
  // included) or work package. Toggled by the row's filter icon, never by the
  // row click itself.
  soloBusinessObjectId: null,
  soloWorkPackageId: null,
  collapsedIds: [],
  // picking mode: business object armed for link/unlink clicks on the map
  linkingBusinessObjectId: null,
  // picking mode: work package armed for link/unlink clicks on the map
  // (one live link per annotation and listing — replace rule)
  linkingWorkPackageId: null,
};

// Every state that targets ONE object / work package: cleared together on a
// module switch, a listing switch and a panel tab switch.
function resetObjectFocus(state) {
  state.activeBusinessObjectId = null;
  state.activeWorkPackageId = null;
  state.soloBusinessObjectId = null;
  state.soloWorkPackageId = null;
  state.linkingBusinessObjectId = null;
  state.linkingWorkPackageId = null;
}

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
    triggerWorkPackagesUpdate: (state) => {
      state.workPackagesUpdatedAt = Date.now();
    },
    triggerRelsWorkPackageAnnotationUpdate: (state) => {
      state.relsWorkPackageUpdatedAt = Date.now();
    },
    //
    setSelectedListingId: (state, action) => {
      state.selectedListingId = action.payload;
      resetObjectFocus(state);
    },
    setActiveBusinessObjectId: (state, action) => {
      state.activeBusinessObjectId = action.payload;
      if (action.payload) state.activeWorkPackageId = null;
    },
    setActiveWorkPackageId: (state, action) => {
      state.activeWorkPackageId = action.payload;
      if (action.payload) {
        state.activeBusinessObjectId = null;
        state.linkingBusinessObjectId = null;
      }
    },
    setSoloBusinessObjectId: (state, action) => {
      state.soloBusinessObjectId = action.payload;
      if (action.payload) state.soloWorkPackageId = null;
    },
    setSoloWorkPackageId: (state, action) => {
      state.soloWorkPackageId = action.payload;
      if (action.payload) state.soloBusinessObjectId = null;
    },
    setLinkingWorkPackageId: (state, action) => {
      state.linkingWorkPackageId = action.payload;
      if (action.payload) state.linkingBusinessObjectId = null;
    },
    setPanelTabKey: (state, action) => {
      state.panelTabKey = action.payload;
      resetObjectFocus(state);
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
      if (action.payload) state.linkingWorkPackageId = null;
    },
  },
  extraReducers: (builder) => {
    // A module switch clears the active object, the solo and the picking mode
    // — leaving the business-objects modules, or moving between two of them
    // (one per business object type: a soloed object of type A must not
    // leak into the module of type B). Keyed on the MODULE switch (not on a
    // viewer unmount): the 2D↔3D editor toggle (T) unmounts the 2D viewer
    // while the module stays selected (setModuleEditorKey), and the state
    // must survive it. useSwitchViewer never re-dispatches the same key.
    builder.addCase(setSelectedViewerKey, (state) => {
      resetObjectFocus(state);
    });
  },
});

export const {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
  triggerWorkPackagesUpdate,
  triggerRelsWorkPackageAnnotationUpdate,
  setSelectedListingId,
  setActiveBusinessObjectId,
  setActiveWorkPackageId,
  setSoloBusinessObjectId,
  setSoloWorkPackageId,
  setLinkingWorkPackageId,
  setPanelTabKey,
  toggleBusinessObjectCollapsed,
  setLinkingBusinessObjectId,
} = businessObjectsSlice.actions;

export default businessObjectsSlice.reducer;
