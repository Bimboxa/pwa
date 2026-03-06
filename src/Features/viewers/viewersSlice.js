import { createSlice } from "@reduxjs/toolkit";

const viewersInitialState = {
  //
  selectedViewerKey: "MAP", // "MAP", "THREED", "LEAFLET", "TABLE", "PORTFOLIO"
  viewerReturnContext: null, // { fromViewer, portfolioId, listingId, ... }
};

export const viewersSlice = createSlice({
  name: "viewers",
  initialState: viewersInitialState,
  reducers: {
    setSelectedViewerKey: (state, action) => {
      state.selectedViewerKey = action.payload;
    },
    setViewerReturnContext: (state, action) => {
      state.viewerReturnContext = action.payload;
    },
  },
});

export const {
  setSelectedViewerKey,
  setViewerReturnContext,
  //
} = viewersSlice.actions;

export default viewersSlice.reducer;
