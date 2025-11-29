import { createSlice } from "@reduxjs/toolkit";

const threedEditorInitialState = {
  //
  enabled: false,
  //
  showShapes: true,
  //
};

export const threedEditorSlice = createSlice({
  name: "threedEditor",
  initialState: threedEditorInitialState,
  reducers: {
    setEnabled: (state, action) => {
      state.enabled = action.payload;
    },
    setShowShapes: (state, action) => {
      state.showShapes = action.payload;
    },
  },
});

export const {
  setShowShapes,
  setEnabled,
  //
} = threedEditorSlice.actions;

export default threedEditorSlice.reducer;
