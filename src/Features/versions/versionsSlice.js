import { createSlice } from "@reduxjs/toolkit";

const versionsInitialState = {
  items: [],
  //
  versionsUpdatedAt: null,
  //
  selectedVersionId: null,
  //
  selectedItems: [],
  expandedItems: [],
};

export const versionsSlice = createSlice({
  name: "versions",
  initialState: versionsInitialState,
  reducers: {
    setSelectedVersionId: (state, action) => {
      state.selectedVersionId = action.payload;
    },
    setSelectedItems: (state, action) => {
      state.selectedItems = action.payload;
    },
    setExpandedItems: (state, action) => {
      state.expandedItems = action.payload;
    },
    triggerVersionsUpdate: (state) => {
      state.versionsUpdatedAt = Date.now();
    },
    setVersions: (state, action) => {
      state.items = action.payload;
      state.versionsUpdatedAt = Date.now();
    },
    createVersion: (state, action) => {
      state.items.push(action.payload);
      state.versionsUpdatedAt = Date.now();
    },
    updateVersion: (state, action) => {
      console.log("[STATE] debug_2110_updateVersion", action.payload);
      state.items = state.items.map((item) =>
        item.id === action.payload.id ? action.payload : item
      );
      state.versionsUpdatedAt = Date.now();
    },
  },
});

export const {
  triggerVersionsUpdate,
  setVersions,
  createVersion,
  updateVersion,
  //
  setSelectedVersionId,
  //
  setSelectedItems,
  setExpandedItems,
} = versionsSlice.actions;

export default versionsSlice.reducer;
