import { createSlice } from "@reduxjs/toolkit";

const leftPanelInitialState = {
  verticalBarWidth: 80, //64
  width: 320,
  openLeftPanel: true,
  leftPanelDocked: false,
  leftDrawerHovered: false,
  //
};

export const leftPanelSlice = createSlice({
  name: "leftPanel",
  initialState: leftPanelInitialState,
  reducers: {
    setOpenLeftPanel: (state, action) => {
      state.openLeftPanel = action.payload;
    },
    setLeftPanelDocked: (state, action) => {
      state.leftPanelDocked = action.payload;
    },
    setLeftDrawerHovered: (state, action) => {
      state.leftDrawerHovered = action.payload;
    },
  },
});

export const { setOpenLeftPanel, setLeftPanelDocked, setLeftDrawerHovered } =
  leftPanelSlice.actions;

export default leftPanelSlice.reducer;
