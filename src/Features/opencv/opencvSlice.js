import { createSlice } from "@reduxjs/toolkit";

const opencvInitialState = {
  // OpenCV mask image (for debugging/display)
  maskImageUrl: null,
};

export const opencvSlice = createSlice({
  name: "opencv",
  initialState: opencvInitialState,
  reducers: {
    setMaskImageUrl: (state, action) => {
      // Revoke previous URL if exists
      if (state.maskImageUrl) {
        URL.revokeObjectURL(state.maskImageUrl);
      }
      state.maskImageUrl = action.payload;
    },
    clearMaskImageUrl: (state) => {
      if (state.maskImageUrl) {
        URL.revokeObjectURL(state.maskImageUrl);
      }
      state.maskImageUrl = null;
    },
  },
});

export const { setMaskImageUrl, clearMaskImageUrl } = opencvSlice.actions;

export default opencvSlice.reducer;
