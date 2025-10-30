import { createSlice } from "@reduxjs/toolkit";

const contextMenuInitialState = {
  //
  anchorPosition: null,
};

export const contextMenuSlice = createSlice({
  name: "contextMenu",
  initialState: contextMenuInitialState,
  reducers: {
    setAnchorPosition: (state, action) => {
      state.anchorPosition = action.payload;
    },
  },
});

export const { setAnchorPosition } = contextMenuSlice.actions;

export default contextMenuSlice.reducer;
