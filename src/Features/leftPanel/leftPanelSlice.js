import { createSlice } from "@reduxjs/toolkit";

const leftPanelInitialState = {
  verticalBarWidth: 56,
  width: 350,
  openLeftPanel: false,
  //
  openedPanel: "LISTING", // "LISTING", "LISTING_SELECTOR"
};

export const leftPanelSlice = createSlice({
  name: "leftPanel",
  initialState: leftPanelInitialState,
  reducers: {
    setOpenLeftPanel: (state, action) => {
      state.openLeftPanel = action.payload;
    },
    setOpenedPanel: (state, action) => {
      state.openedPanel = action.payload;
    },
  },
});

export const { setOpenLeftPanel, setOpenedPanel } = leftPanelSlice.actions;

export default leftPanelSlice.reducer;
