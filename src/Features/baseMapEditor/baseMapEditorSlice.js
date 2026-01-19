import { createSlice } from "@reduxjs/toolkit";
import theme from "Styles/theme";

//import demoMarker from "./data/demoMarker";

const baseMapEditorInitialState = {
  selectedTab: "INFO", // INFO, TOOLS, ANNOTATIONS
  //
  grayLevelThreshold: 255, // 255 = on laisse tout, 0 = on coupe tout
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
  },
});

export const {
  setSelectedTab,
  setGrayLevelThreshold,
} = baseMapEditorSlice.actions;

export default baseMapEditorSlice.reducer;
