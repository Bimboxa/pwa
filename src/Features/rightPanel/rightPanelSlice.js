import { bottomNavigationActionClasses } from "@mui/material";
import { createSlice } from "@reduxjs/toolkit";

const rightPanelInitialState = {
  width: 300,
  //
  selectedMenuItemKey: null, // SHOWER, ENTITY, ANNOTATION_FORMAT
  //
  selectedScopeIdInDashboard: null,
};

export const rightPanelSlice = createSlice({
  name: "rightPanel",
  initialState: rightPanelInitialState,
  reducers: {
    setSelectedMenuItemKey: (state, action) => {
      state.selectedMenuItemKey = action.payload;
    },
  },
});

export const { setSelectedMenuItemKey } = rightPanelSlice.actions;

export default rightPanelSlice.reducer;
