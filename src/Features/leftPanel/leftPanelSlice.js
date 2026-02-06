import { createSlice } from "@reduxjs/toolkit";

const leftPanelInitialState = {
  verticalBarWidth: 80, //64
  width: 320,
  openLeftPanel: true,
  //
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
