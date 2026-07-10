import { createSlice } from "@reduxjs/toolkit";

const scopeFavoritesInitialState = {
  favorites: [], // [{scopeId, scopeName, projectName, projectClientRef, projectType}]
  fetchedAt: null,
};

export const scopeFavoritesSlice = createSlice({
  name: "scopeFavorites",
  initialState: scopeFavoritesInitialState,
  reducers: {
    setFavorites: (state, action) => {
      state.favorites = action.payload ?? [];
      state.fetchedAt = Date.now();
    },
    addFavoriteLocal: (state, action) => {
      const favorite = action.payload;
      if (!favorite?.scopeId) return;
      const exists = state.favorites.some(
        (f) => String(f.scopeId) === String(favorite.scopeId)
      );
      if (!exists) state.favorites.push(favorite);
    },
    removeFavoriteLocal: (state, action) => {
      const scopeId = action.payload;
      state.favorites = state.favorites.filter(
        (f) => String(f.scopeId) !== String(scopeId)
      );
    },
  },
});

export const { setFavorites, addFavoriteLocal, removeFavoriteLocal } =
  scopeFavoritesSlice.actions;

export default scopeFavoritesSlice.reducer;
