import { createSlice } from "@reduxjs/toolkit";

const listingViewerInitialState = {
  selectedListingId: null,
  selectedTabId: "ANNOTATION_TEMPLATES",
};

export const listingViewerSlice = createSlice({
  name: "listingViewer",
  initialState: listingViewerInitialState,
  reducers: {
    setListingViewerSelectedListingId: (state, action) => {
      state.selectedListingId = action.payload;
    },
    setSelectedTabId: (state, action) => {
      state.selectedTabId = action.payload;
    },
  },
});

export const {
  setListingViewerSelectedListingId,
  setSelectedTabId,
} = listingViewerSlice.actions;

export default listingViewerSlice.reducer;
