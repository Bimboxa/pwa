import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  selectedEntityModelKey: null,
  selectedListingId: null,
  selectedEntityId: null,
  searchQuery: "",
};

export const adminEditorSlice = createSlice({
  name: "adminEditor",
  initialState,
  reducers: {
    setAdminSelectedEntityModelKey: (state, action) => {
      state.selectedEntityModelKey = action.payload;
      state.selectedListingId = null;
      state.selectedEntityId = null;
    },
    setAdminSelectedListingId: (state, action) => {
      state.selectedListingId = action.payload;
      state.selectedEntityId = null;
    },
    setAdminSelectedEntityId: (state, action) => {
      state.selectedEntityId = action.payload;
    },
    setAdminSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
  },
});

export const {
  setAdminSelectedEntityModelKey,
  setAdminSelectedListingId,
  setAdminSelectedEntityId,
  setAdminSearchQuery,
} = adminEditorSlice.actions;

export default adminEditorSlice.reducer;
