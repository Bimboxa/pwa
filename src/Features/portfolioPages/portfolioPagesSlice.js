import { createSlice } from "@reduxjs/toolkit";

const portfolioPagesInitialState = {
  editedPortfolioPage: null,
};

export const portfolioPagesSlice = createSlice({
  name: "portfolioPages",
  initialState: portfolioPagesInitialState,
  reducers: {
    setEditedPortfolioPage: (state, action) => {
      state.editedPortfolioPage = action.payload;
    },
  },
});

export const { setEditedPortfolioPage } = portfolioPagesSlice.actions;

export default portfolioPagesSlice.reducer;
