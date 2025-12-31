import { createSlice } from "@reduxjs/toolkit";
import theme from "Styles/theme";

//import demoMarker from "./data/demoMarker";

const baseMapEditorInitialState = {
  selectedTab: "INFO", // INFO, TOOLS, ANNOTATIONS
};

export const baseMapEditorSlice = createSlice({
  name: "baseMapEditor",
  initialState: baseMapEditorInitialState,
  reducers: {
    setSelectedTab: (state, action) => {
      state.selectedTab = action.payload;
    }
  },
});

export const {
  setSelectedTab,
} = baseMapEditorSlice.actions;

export default baseMapEditorSlice.reducer;
