import {createSlice} from "@reduxjs/toolkit";

const threedEditorInitialState = {
  //
  showShapes: true,
  //
};

export const threedEditorSlice = createSlice({
  name: "threedEditor",
  initialState: threedEditorInitialState,
  reducers: {
    setShowShapes: (state, action) => {
      state.showShapes = action.payload;
    },
  },
});

export const {
  setShowShapes,
  //
} = threedEditorSlice.actions;

export default threedEditorSlice.reducer;
