import { createSlice } from "@reduxjs/toolkit";

const bgImageInitialState = {
  showBgImageInMapEditor: false,
  bgImageKeyInMapEditor: "DEFAULT",
};

export const bgImageSlice = createSlice({
  name: "bgImage",
  initialState: bgImageInitialState,
  reducers: {
    setShowBgImageInMapEditor: (state, action) => {
      state.showBgImageInMapEditor = action.payload;
    },
    setBgImageKeyInMapEditor: (state, action) => {
      state.bgImageKeyInMapEditor = action.payload;
    },
  },
});

export const { setShowBgImageInMapEditor, setBgImageKeyInMapEditor } =
  bgImageSlice.actions;

export default bgImageSlice.reducer;
