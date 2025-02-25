import {createSlice} from "@reduxjs/toolkit";

const listPanelInitialState = {
  width: 400,
  open: true,
  //
  selectedListId: null,
};

export const listPanelSlice = createSlice({
  name: "listPanel",
  initialState: listPanelInitialState,
  reducers: {
    setOpen: (state, action) => {
      state.open = action.payload;
    },
    setWidth: (state, action) => {
      state.width = action.payload;
    },
    //
    setSelectedListId: (state, action) => {
      state.selectedListId = action.payload;
    },
  },
});

export const {
  setOpen,
  setWidth,
  //
  setSelectedListId,
} = listPanelSlice.actions;

export default listPanelSlice.reducer;
