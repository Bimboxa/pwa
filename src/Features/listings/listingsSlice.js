import {createSlice} from "@reduxjs/toolkit";

import exampleListingsMap from "./data/exampleListingsMap";

import setInitListingId from "Features/init/services/setInitListingId";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

const listingsInitialState = {
  //
  listingsMap: exampleListingsMap,
  listingsUpdatedAt: null,
  listingsById: {},
  //
  selectedListingId: null,
  //
  openListingSyncDetail: false,
};

export const listingsSlice = createSlice({
  name: "listings",
  initialState: listingsInitialState,
  reducers: {
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
