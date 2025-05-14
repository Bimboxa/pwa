import {createSlice} from "@reduxjs/toolkit";

const listingsConfigInitialState = {
  openPanel: false,
  openPanelDownloadListingsData: false,
  tempListings: [],
};

export const listingsConfigSlice = createSlice({
  name: "listingsConfig",
  initialState: listingsConfigInitialState,
  reducers: {
    setOpenPanelDownloadListingsData: (state, action) => {
      state.openPanelDownloadListingsData = action.payload;
    },
    setOpenPanel: (state, action) => {
      state.openPanel = action.payload;
    },
    setTempListings: (state, action) => {
      state.tempListings = action.payload;
    },
  },
});

export const {setTempListings, setOpenPanel, setOpenPanelDownloadListingsData} =
  listingsConfigSlice.actions;

export default listingsConfigSlice.reducer;
