import {createSlice} from "@reduxjs/toolkit";

import exampleListingsMap from "./data/exampleListingsMap";

import setInitListingId from "Features/init/services/setInitListingId";

const listingsInitialState = {
  //
  listingsMap: exampleListingsMap,
  listingsUpdatedAt: null,
  //
  selectedListingId: null,
  //
  openListingSyncDetail: false,
};

export const listingsSlice = createSlice({
  name: "listings",
  initialState: listingsInitialState,
  reducers: {
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
  setSelectedListingId,
  triggerListingsUpdate,
  //
  createListing,
  updateListing,
  //
  setOpenListingSyncDetail,
} = listingsSlice.actions;

export default listingsSlice.reducer;
