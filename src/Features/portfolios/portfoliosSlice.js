import { createSlice } from "@reduxjs/toolkit";

const portfoliosInitialState = {
  displayedPortfolioId: null,
  editedPortfolio: null,
  collapsedPortfolioIds: [],
};

export const portfoliosSlice = createSlice({
  name: "portfolios",
  initialState: portfoliosInitialState,
  reducers: {
    setDisplayedPortfolioId: (state, action) => {
      state.displayedPortfolioId = action.payload;
    },
    setEditedPortfolio: (state, action) => {
      state.editedPortfolio = action.payload;
    },
    togglePortfolioCollapsed: (state, action) => {
      const id = action.payload;
      const idx = state.collapsedPortfolioIds.indexOf(id);
      if (idx === -1) {
        state.collapsedPortfolioIds.push(id);
      } else {
        state.collapsedPortfolioIds.splice(idx, 1);
      }
    },
  },
});

export const { setDisplayedPortfolioId, setEditedPortfolio, togglePortfolioCollapsed } =
  portfoliosSlice.actions;

export default portfoliosSlice.reducer;
