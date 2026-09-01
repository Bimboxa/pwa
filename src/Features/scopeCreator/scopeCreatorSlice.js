import { createSlice } from "@reduxjs/toolkit";

const scopeCreatorInitialState = {
  openScopeCreator: false,
};

export const scopeCreatorSlice = createSlice({
  name: "scopeCreator",
  initialState: scopeCreatorInitialState,
  reducers: {
    setOpenScopeCreator: (state, action) => {
      state.openScopeCreator = action.payload;
    },
  },
});

export const { setOpenScopeCreator } = scopeCreatorSlice.actions;

export default scopeCreatorSlice.reducer;
