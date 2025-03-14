import {createSlice} from "@reduxjs/toolkit";

import exampleListingsMap from "./data/exampleListingsMap";

const listingsInitialState = {
  //
  listingsMap: exampleListingsMap,
  listingsUpdatedAt: null,
  //
  selectedListingId: null,
  //
};

export const listingsSlice = createSlice({
  name: "listings",
  initialState: listingsInitialState,
  reducers: {
    setSelectedListingId: (state, action) => {
      state.selectedListingId = action.payload;
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
  },
});

export const {
  setSelectedListingId,
  triggerListingsUpdate,
  //
  createListing,
  updateListing,
} = listingsSlice.actions;

export default listingsSlice.reducer;
