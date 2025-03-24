import {createSlice} from "@reduxjs/toolkit";

const listPanelInitialState = {
  width: 400,
  open: true,
  //
  openPanelListItem: false,
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
    setOpenPanelListItem: (state, action) => {
      state.openPanelListItem = action.payload;
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
  setOpenPanelListItem,
  //
  setSelectedListId,
} = listPanelSlice.actions;

export default listPanelSlice.reducer;
