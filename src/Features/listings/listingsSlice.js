import { createSlice } from "@reduxjs/toolkit";

import exampleListingsMap from "./data/exampleListingsMap";

import setInitListingId from "Features/init/services/setInitListingId";
import getInitScopeVisibility from "Features/init/services/getInitScopeVisibility";
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
  // Listings hidden from the editors (eye of the Dessin panel / avatars /
  // SCOPE-module base map folders). Per-scope local state: re-hydrated from
  // localStorage on every scope selection (scopeVisibilityPersistMiddleware
  // saves it), so ids never leak from one scope to the next.
  hiddenListingsIds: [],
  //
  // SCOPE module (Krto) in "all listings" mode: the recap editor shows every
  // base map and the annotations of every listing of the scope. A flag of
  // its own, not selectedListingId === null: the selected listing is the
  // app-wide active listing (Dessin, creation flows) and useAutoSelectListing
  // never leaves it null. Default true so the module opens on the whole
  // scope; reset on every scope selection. Not persisted.
  scopeModuleShowAllListings: true,
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
    setScopeModuleShowAllListings: (state, action) => {
      state.scopeModuleShowAllListings = Boolean(action.payload);
    },
  },
  extraReducers: (builder) => {
    // Matched by type string to avoid importing scopesSlice (setInitListingId
    // is already the only init dependency here).
    builder.addMatcher(
      (action) => action.type === "scopes/setSelectedScopeId",
      (state, action) => {
        state.hiddenListingsIds =
          getInitScopeVisibility(action.payload)?.hiddenListingsIds ?? [];
        state.scopeModuleShowAllListings = true;
      }
    );
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
  //
  setScopeModuleShowAllListings,
} = listingsSlice.actions;

export default listingsSlice.reducer;
