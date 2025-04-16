import {createSlice} from "@reduxjs/toolkit";

import setInitScopeId from "Features/init/services/setInitScopeId";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

const scopesInitialState = {
  scopesById: {},
  scopesUpdatedAt: null,
  //
  selectedScopeId: null,
  //
  newScope: null,
  editedScope: null,
  isEditingScope: false,
  //
  relsScopeItemByScopeId: {},
};

export const scopesSlice = createSlice({
  name: "scopes",
  initialState: scopesInitialState,
  reducers: {
    //
    setScopesById: (state, action) => {
      const scopes = action.payload;
      state.scopesById = getItemsByKey(scopes, "id");
      state.scopesUpdatedAt = Date.now();
    },
    //
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
    //
    setRelsScopeItemByScopeId: (state, action) => {
      const rels = action.payload;
      const relsByScopeId = {};
      rels.forEach((rel) => {
        const scopeId = rel.scopeId;
        if (!relsByScopeId[scopeId]) {
          relsByScopeId[scopeId] = [];
        }
        relsByScopeId[scopeId].push(rel);
      });
      state.relsScopeItemByScopeId = relsByScopeId;
    },
  },
});

export const {
  setScopesById,
  //
  setSelectedScopeId,
  //
  setNewScope,
  setEditedScope,
  setIsEditingScope,
  //
  setRelsScopeItemByScopeId,
} = scopesSlice.actions;

export default scopesSlice.reducer;
