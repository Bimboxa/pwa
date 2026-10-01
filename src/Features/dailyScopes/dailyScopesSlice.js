import { createSlice } from "@reduxjs/toolkit";

const dailyScopesInitialState = {
  // [{scopeId, scopeName, projectName, projectClientRef, projectType,
  //   lastConfigurationAt, createdBy: {idMaster, trigram}}]
  items: [],
  date: null, // "YYYY-MM-DD" civil day of the fetched items
  fetchedAt: null,
};

export const dailyScopesSlice = createSlice({
  name: "dailyScopes",
  initialState: dailyScopesInitialState,
  reducers: {
    setDailyScopes: (state, action) => {
      const { items, date } = action.payload ?? {};
      state.items = items ?? [];
      state.date = date ?? null;
      state.fetchedAt = Date.now();
    },
  },
});

export const { setDailyScopes } = dailyScopesSlice.actions;

export default dailyScopesSlice.reducer;
