import { createSlice } from "@reduxjs/toolkit";

import exampleListingsMap from "./data/exampleListingsMap";

import setInitListingId from "Features/init/services/setInitListingId";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

const listingsInitialState = {
  openSelectorPanel: false,
  openDialogAddListing: false, // TO REMOVE ?
  openPanelAddListing: false,
  //
  openedPanel: "LISTING", // "LISTING", "LISTING_SELECTOR", "NEW_ENTITY", "EDITED_ENTITY"
  //
  listingsMap: exampleListingsMap,
  listingsUpdatedAt: null,
  listingsById: null,
  // {[hostScopeId]: {[listingId]: sourceScopeId}} — listings LINKED into a
  // scope from another scope (db.relsScopeListing live-synced by
  // dexieSyncService, live rows only). Precomputed here so the db guard and
  // the listings selector do O(1) lookups. Dangling links (source listing /
  // scope not loaded) are filtered at read time by getLinkedListingIdsForScope.
  linkedListingSourceByScopeId: {},
  //
  selectedListingId: null,
  //
  openListingSyncDetail: false,
  //
  hiddenListingsIds: [],
};

export const listingsSlice = createSlice({
  name: "listings",
  initialState: listingsInitialState,
  reducers: {
    setOpenSelectorPanel: (state, action) => {
      state.openSelectorPanel = action.payload;
    },
    setOpenDialogAddListing: (state, action) => {
      state.openDialogAddListing = action.payload;
    },
    setOpenPanelAddListing: (state, action) => {
      state.openPanelAddListing = action.payload;
    },
    setOpenedPanel: (state, action) => {
      state.openedPanel = action.payload;
    },
    setListingsById: (state, action) => {
      const listings = action.payload;
      state.listingsById = getItemsByKey(listings, "id");
      state.listingsUpdatedAt = Date.now();
    },
    setSelectedListingId: (state, action) => {
      state.selectedListingId = action.payload;
      setInitListingId(action.payload);
    },
    setRelsScopeListing: (state, action) => {
      const rels = action.payload ?? [];
      const byScopeId = {};
      for (const rel of rels) {
        if (!rel || rel.deletedAt || !rel.scopeId || !rel.listingId) continue;
        if (!byScopeId[rel.scopeId]) byScopeId[rel.scopeId] = {};
        byScopeId[rel.scopeId][rel.listingId] = rel.sourceScopeId ?? null;
      }
      state.linkedListingSourceByScopeId = byScopeId;
    },
    //
    triggerListingsUpdate: (state) => {
      state.listingsUpdatedAt = Date.now();
    },
    //
    createListing: (state, action) => {
      const listing = action.payload;
      state.listingsListing[listing.id] = listing;
    },
    updateListing: (state, action) => {
      const updates = action.payload;
      const listing = state.listingsListing[updates.id];
      state.listingsListing[updates.id] = { ...listing, ...updates };
    },
    //
    setOpenListingSyncDetail: (state, action) => {
      state.openListingSyncDetail = action.payload;
    },
    //
    setHiddenListingsIds: (state, action) => {
      state.hiddenListingsIds = action.payload;
    },
    hideListingId: (state, action) => {
      state.hiddenListingsIds = [...state.hiddenListingsIds, action.payload];
    },
    showListingId: (state, action) => {
      state.hiddenListingsIds = state.hiddenListingsIds.filter(
        (id) => id !== action.payload
      );
    },
  },
});

export const {
  setOpenDialogAddListing,
  setOpenPanelAddListing,
  setOpenSelectorPanel,
  //
  setOpenedPanel,
  //
  setListingsById,
  //
  setSelectedListingId,
  setRelsScopeListing,
  triggerListingsUpdate,
  //
  createListing,
  updateListing,
  //
  setOpenListingSyncDetail,
  //
  hideListingId,
  showListingId,
  setHiddenListingsIds,
} = listingsSlice.actions;

export default listingsSlice.reducer;
