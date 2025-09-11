import { createSlice } from "@reduxjs/toolkit";

const leftPanelInitialState = {
  width: 350,
  openLeftPanel: false,
};

export const leftPanelSlice = createSlice({
  name: "leftPanel",
  initialState: leftPanelInitialState,
  reducers: {
    setOpenLeftPanel: (state, action) => {
      state.openLeftPanel = action.payload;
    },
  },
});

export const { setOpenLeftPanel } = leftPanelSlice.actions;

export default leftPanelSlice.reducer;
