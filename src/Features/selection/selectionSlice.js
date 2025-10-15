import { createSlice } from "@reduxjs/toolkit";

const selectionInitialState = {
  selectedItem: null,
  openDialogDeleteSelectedItem: false,
};

export const selectionSlice = createSlice({
  name: "selection",
  initialState: selectionInitialState,
  reducers: {
    setSelectedItem: (state, action) => {
      state.selectedItem = action.payload;
    },
    setOpenDialogDeleteSelectedItem: (state, action) => {
      state.openDialogDeleteSelectedItem = action.payload;
    },
  },
});

export const { setSelectedItem, setOpenDialogDeleteSelectedItem } =
  selectionSlice.actions;

export default selectionSlice.reducer;
