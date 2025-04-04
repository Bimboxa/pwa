import {createSlice} from "@reduxjs/toolkit";

import setInitScopeId from "Features/init/services/setInitScopeId";

const scopesInitialState = {
  //
  scopesUpdatedAt: null,
  //
  selectedScopeId: null,
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
      setInitScopeId(action.payload);
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
