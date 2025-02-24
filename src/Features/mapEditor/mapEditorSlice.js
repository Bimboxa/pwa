import {createSlice} from "@reduxjs/toolkit";

const mapEditorInitialState = {
  //
  showShapes: true,
  //
};

export const mapEditorSlice = createSlice({
  name: "mapEditors",
  initialState: mapEditorInitialState,
  reducers: {
    setShowShapes: (state, action) => {
      state.showShapes = action.payload;
    },
  },
});

export const {
  setShowShapes,
  //
} = mapEditorSlice.actions;

export default mapEditorSlice.reducer;
