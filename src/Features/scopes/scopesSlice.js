import { createSlice } from "@reduxjs/toolkit";

import setInitScopeId from "Features/init/services/setInitScopeId";
import getInitScopeOpeningSource from "Features/init/services/getInitScopeOpeningSource";
import setInitScopeOpeningSource from "Features/init/services/setInitScopeOpeningSource";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

const scopesInitialState = {
  scopesById: {},
  scopesUpdatedAt: null,
  //
  selectedScopeId: null,
  // { scopeId, projectId } | null — project the scope was opened from when
  // it is not its own project (Krto of a linked project opened from the
  // dashboard panel of another project). Persisted across reloads. Only
  // meaningful while scopeId is the selected scope: read it through
  // useScopeOpeningSourceProject.
  openingSource: getInitScopeOpeningSource(),
  //
  newScope: null,
  editedScope: null,
  isEditingScope: false,
  //
  relsScopeItemByScopeId: {},
  //
  openSelectorScope: false,
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
    //
    setSelectedScopeId: (state, action) => {
      state.selectedScopeId = action.payload;
      setInitScopeId(action.payload);
    },
    setScopeOpeningSource: (state, action) => {
      state.openingSource = action.payload ?? null;
      setInitScopeOpeningSource(state.openingSource);
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
    setOpenSelectorScope: (state, action) => {
      state.openSelectorScope = action.payload;
    },
  },
});

export const {
  setScopesById,
  //
  setSelectedScopeId,
  setScopeOpeningSource,
  //
  setNewScope,
  setEditedScope,
  setIsEditingScope,
  //
  setRelsScopeItemByScopeId,
  //
  setOpenSelectorScope,
} = scopesSlice.actions;

export default scopesSlice.reducer;
