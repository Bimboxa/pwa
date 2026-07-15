import { createSlice } from "@reduxjs/toolkit";

const dailyScopesInitialState = {
  // [{scopeId, scopeName, projectName, projectClientRef, projectType,
  //   lastConfigurationAt, createdBy: {idMaster, trigram}}]
  items: [],
  fetchedAt: null,
};

export const dailyScopesSlice = createSlice({
  name: "dailyScopes",
  initialState: dailyScopesInitialState,
  reducers: {
    setDailyScopes: (state, action) => {
      state.items = action.payload ?? [];
      state.fetchedAt = Date.now();
    },
  },
});

export const { setDailyScopes } = dailyScopesSlice.actions;

export default dailyScopesSlice.reducer;
