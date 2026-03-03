import { createSlice } from "@reduxjs/toolkit";
import theme from "Styles/theme";

//import demoMarker from "./data/demoMarker";

const baseMapEditorInitialState = {
  selectedTab: "INFO", // INFO, TOOLS, ANNOTATIONS
  //
  grayLevelThreshold: 255, // 255 = on laisse tout, 0 = on coupe tout
  // viewer
  displayedBaseMapListingId: null,
  collapsedListingIds: [],
  creatingInListingId: null,
};

export const baseMapEditorSlice = createSlice({
  name: "baseMapEditor",
  initialState: baseMapEditorInitialState,
  reducers: {
    setSelectedTab: (state, action) => {
      state.selectedTab = action.payload;
    },
    setGrayLevelThreshold: (state, action) => {
      state.grayLevelThreshold = action.payload;
    },
    // viewer
    setDisplayedBaseMapListingId: (state, action) => {
      state.displayedBaseMapListingId = action.payload;
    },
    setCreatingInListingId: (state, action) => {
      state.creatingInListingId = action.payload;
    },
    toggleListingCollapsed: (state, action) => {
      const id = action.payload;
      const idx = state.collapsedListingIds.indexOf(id);
      if (idx === -1) {
        state.collapsedListingIds.push(id);
      } else {
        state.collapsedListingIds.splice(idx, 1);
      }
    },
  },
});

export const {
  setSelectedTab,
  setGrayLevelThreshold,
  setDisplayedBaseMapListingId,
  setCreatingInListingId,
  toggleListingCollapsed,
} = baseMapEditorSlice.actions;

export default baseMapEditorSlice.reducer;
