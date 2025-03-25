import {createSlice} from "@reduxjs/toolkit";

import demoScope from "./data/demoScope";

const scopesInitialState = {
  //
  scopesUpdatedAt: null,
  //
  selectedScopeId: "demo",
  //
  newScope: null,
  editedScope: null,
  isEditingScope: false,
};

export const scopesSlice = createSlice({
  name: "scopes",
  initialState: scopesInitialState,
  reducers: {
    setSelectedScopeId: (state, action) => {
      state.selectedScopeId = action.payload;
    },
    //
    setNewScope: (state, action) => {
      state.newScope = action.payload;
    },
    setEditedScope: (state, action) => {
      state.editedScope = action.payload;
    },
    setIsEditingScope: (state, action) => {
      state.isEditingScope = action.payload;
    },
  },
});

export const {
  setSelectedScopeId,
  //
  setNewScope,
  setEditedScope,
  setIsEditingScope,
} = scopesSlice.actions;

export default scopesSlice.reducer;
