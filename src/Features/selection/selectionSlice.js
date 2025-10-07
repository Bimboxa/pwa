import { createSlice } from "@reduxjs/toolkit";

const selectionInitialState = {
  selectedItem: null,
};

export const selectionSlice = createSlice({
  name: "selection",
  initialState: selectionInitialState,
  reducers: {
    setSelectedItem: (state, action) => {
      state.selectedItem = action.payload;
    },
  },
});

export const { setSelectedItem } = selectionSlice.actions;

export default selectionSlice.reducer;
