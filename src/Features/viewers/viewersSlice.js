import { createSlice } from "@reduxjs/toolkit";

const viewersInitialState = {
  //
  selectedViewerKey: "MAP", // "MAP", "THREED", "LEAFLET", "TABLE", "PORTFOLIO"
  portfolioReturnContext: null,
};

export const viewersSlice = createSlice({
  name: "viewers",
  initialState: viewersInitialState,
  reducers: {
    setSelectedViewerKey: (state, action) => {
      state.selectedViewerKey = action.payload;
    },
    setPortfolioReturnContext: (state, action) => {
      state.portfolioReturnContext = action.payload;
    },
  },
});

export const {
  setSelectedViewerKey,
  setPortfolioReturnContext,
  //
} = viewersSlice.actions;

export default viewersSlice.reducer;
