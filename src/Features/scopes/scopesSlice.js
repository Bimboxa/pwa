import {createSlice} from "@reduxjs/toolkit";

import demoScope from "./data/demoScope";

const scopesInitialState = {
  //
  scopesMap: new Map([["demo", demoScope]]),
  scopesUpdatedAt: null,
  //
  selectedScopeId: "demo",
  //
};

export const scopesSlice = createSlice({
  name: "scopes",
  initialState: scopesInitialState,
  reducers: {
    setSelectedScopeId: (state, action) => {
      state.selectedScopeId = action.payload;
    },
  },
});

export const {
  setSelectedScopeId,
  //
} = scopesSlice.actions;

export default scopesSlice.reducer;
