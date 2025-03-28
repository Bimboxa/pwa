import {createSlice} from "@reduxjs/toolkit";

const zonesInitialState = {
  //
  zonesUpdatedAt: null,
  //
  selectedZoneId: null,
  //
  selectedItems: [],
  expandedItems: [],
};

export const zonesSlice = createSlice({
  name: "zones",
  initialState: zonesInitialState,
  reducers: {
    setSelectedZoneId: (state, action) => {
      state.selectedZoneId = action.payload;
    },
    setSelectedItems: (state, action) => {
      state.selectedItems = action.payload;
    },
    setExpandedItems: (state, action) => {
      state.expandedItems = action.payload;
    },
    triggerZonesUpdate: (state) => {
      state.zonesUpdatedAt = Date.now();
    },
  },
});

export const {
  triggerZonesUpdate,
  //
  setSelectedZoneId,
  //
  setSelectedItems,
  setExpandedItems,
} = zonesSlice.actions;

export default zonesSlice.reducer;
