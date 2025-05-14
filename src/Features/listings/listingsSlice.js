import {createSlice} from "@reduxjs/toolkit";

import exampleListingsMap from "./data/exampleListingsMap";

import setInitListingId from "Features/init/services/setInitListingId";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

const listingsInitialState = {
  openSelectorPanel: false,
  openDialogAddListing: false,
  //
  listingsMap: exampleListingsMap,
  listingsUpdatedAt: null,
  listingsById: null,
  //
  selectedListingId: null,
  //
  openListingSyncDetail: false,
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
    setListingsById: (state, action) => {
      const listings = action.payload;
      state.listingsById = getItemsByKey(listings, "id");
      state.listingsUpdatedAt = Date.now();
    },
    setSelectedListingId: (state, action) => {
      state.selectedListingId = action.payload;
      setInitListingId(action.payload);
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
      state.listingsListing[updates.id] = {...listing, ...updates};
    },
    //
    setOpenListingSyncDetail: (state, action) => {
      state.openListingSyncDetail = action.payload;
    },
  },
});

export const {
  setOpenDialogAddListing,
  setOpenSelectorPanel,
  //
  setListingsById,
  //
  setSelectedListingId,
  triggerListingsUpdate,
  //
  createListing,
  updateListing,
  //
  setOpenListingSyncDetail,
} = listingsSlice.actions;

export default listingsSlice.reducer;
