import { createSlice } from "@reduxjs/toolkit";

const dailyScopesInitialState = {
  // [{scopeId, scopeName, projectName, projectClientRef, projectType,
  //   lastConfigurationAt, createdBy: {idMaster, trigram}}]
  items: [],
  date: null, // "YYYY-MM-DD" civil day currently selected / fetched
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
    // Selected day only: dispatched before the fetch so the UI follows the
    // user's choice even when the request fails or returns no content.
    setDailyScopesDate: (state, action) => {
      state.date = action.payload ?? null;
    },
  },
});

export const { setDailyScopes, setDailyScopesDate } = dailyScopesSlice.actions;

export default dailyScopesSlice.reducer;
