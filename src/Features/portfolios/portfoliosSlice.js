import { createSlice } from "@reduxjs/toolkit";

const portfoliosInitialState = {
  displayedPortfolioId: null,
  editedPortfolio: null,
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
  },
});

export const { setDisplayedPortfolioId, setEditedPortfolio } =
  portfoliosSlice.actions;

export default portfoliosSlice.reducer;
