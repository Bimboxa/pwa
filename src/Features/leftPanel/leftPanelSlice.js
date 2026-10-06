import { createSlice } from "@reduxjs/toolkit";

const leftPanelInitialState = {
  verticalBarWidth: 80, //64
  width: 320,
  openLeftPanel: true,
  // Left module dock: false (default) = hidden, true = pinned open in flow.
  // Toggled from the top bar (ButtonToggleLeftPanelDock); never persisted.
  leftPanelDocked: false,
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
  },
});

export const { setOpenLeftPanel, setLeftPanelDocked } = leftPanelSlice.actions;

export default leftPanelSlice.reducer;
