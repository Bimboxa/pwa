import { createSlice } from "@reduxjs/toolkit";

const listingViewerInitialState = {
  selectedListingId: null,
};

export const listingViewerSlice = createSlice({
  name: "listingViewer",
  initialState: listingViewerInitialState,
  reducers: {
    setListingViewerSelectedListingId: (state, action) => {
      state.selectedListingId = action.payload;
    },
  },
});

export const {
  setListingViewerSelectedListingId,
} = listingViewerSlice.actions;

export default listingViewerSlice.reducer;
