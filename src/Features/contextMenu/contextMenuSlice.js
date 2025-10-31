import { createSlice } from "@reduxjs/toolkit";

const contextMenuInitialState = {
  //
  anchorPosition: null,
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
  },
});

export const { setAnchorPosition, setClickedNode } = contextMenuSlice.actions;

export default contextMenuSlice.reducer;
