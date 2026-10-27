import { createSlice } from "@reduxjs/toolkit";

// Right-click channel of the editors: the 2D InteractionLayer and the 3D
// MainThreedEditor set the cursor anchor on a right click, the commands
// toolbar renders the shortcuts menu there (MenuCommandShortcuts) and clears
// it on close.
const contextMenuInitialState = {
  anchorPosition: null, // { x, y } client coordinates
  clickedNode: null,
};

export const contextMenuSlice = createSlice({
  name: "contextMenu",
  initialState: contextMenuInitialState,
  reducers: {
    setAnchorPosition: (state, action) => {
      state.anchorPosition = action.payload;
    },
    setClickedNode: (state, action) => {
      state.clickedNode = action.payload;
    },
    closeContextMenu: (state) => {
      state.anchorPosition = null;
      state.clickedNode = null;
    },
  },
});

export const { setAnchorPosition, setClickedNode, closeContextMenu } =
  contextMenuSlice.actions;

export const selectContextMenuAnchorPosition = (s) =>
  s.contextMenu.anchorPosition;

export default contextMenuSlice.reducer;
