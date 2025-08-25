import { createSlice } from "@reduxjs/toolkit";
import listTypes from "./data/listTypes";

const listPanelInitialState = {
  width: 300,
  open: true,
  //
  openPanelListItem: false,
  //
  selectedListId: null,
  //
  selectedListTypeKey: null,
  //
  clickedItem: null, // {type,item}. clicked Item from the editors.
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
    //
    setSelectedListTypeKey: (state, action) => {
      state.selectedListTypeKey = action.payload;
    },
    //
    setClickedItem: (state, action) => {
      state.clickedItem = action.payload;
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
  //
  setSelectedListTypeKey,
  //
  setClickedItem,
} = listPanelSlice.actions;

export default listPanelSlice.reducer;
