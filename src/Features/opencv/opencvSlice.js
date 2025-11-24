import { createSlice } from "@reduxjs/toolkit";

const opencvInitialState = {
  // mode
  opencvClickMode: null, // "COLOR_PICKER", used on Click in MapEditor.
  bboxDims: { width: 500, height: 300 }, // { width, height } in px, used to restrict area of computation.

  // OpenCV mask image (for debugging/display)
  opencvPreviewUrl: null,
  showOpencvPreview: true,
  //
  selectedColors: [],
};

export const opencvSlice = createSlice({
  name: "opencv",
  initialState: opencvInitialState,
  reducers: {
    setOpencvPreviewUrl: (state, action) => {
      // Revoke previous URL if exists
      if (state.opencvPreviewUrl) {
        URL.revokeObjectURL(state.opencvPreviewUrl);
      }
      state.opencvPreviewUrl = action.payload;
    },
    setShowOpencvPreview: (state, action) => {
      state.showOpencvPreview = action.payload;
    },
    clearOpencvPreviewUrl: (state) => {
      if (state.opencvPreviewUrl) {
        URL.revokeObjectURL(state.opencvPreviewUrl);
      }
      state.opencvPreviewUrl = null;
    },
    setOpencvClickMode: (state, action) => {
      state.opencvClickMode = action.payload;
    },
    setSelectedColors: (state, action) => {
      state.selectedColors = action.payload;
    },
    addSelectedColor: (state, action) => {
      if (!Array.isArray(state.selectedColors)) {
        state.selectedColors = [];
      }
      const normalizedColor =
        typeof action.payload === "string"
          ? action.payload
          : action.payload?.color;
      if (normalizedColor && !state.selectedColors.includes(normalizedColor)) {
        state.selectedColors.push(normalizedColor);
      }
    },
    removeSelectedColor: (state, action) => {
      state.selectedColors = state.selectedColors.filter(
        (color) => color !== action.payload
      );
    },
    setBboxDims: (state, action) => {
      state.bboxDims = action.payload;
    },
    setKeepColorsPreviewUrl: (state, action) => {
      if (state.keepColorsPreviewUrl) {
        URL.revokeObjectURL(state.keepColorsPreviewUrl);
      }
      state.keepColorsPreviewUrl = action.payload;
    },
    clearKeepColorsPreviewUrl: (state) => {
      if (state.keepColorsPreviewUrl) {
        URL.revokeObjectURL(state.keepColorsPreviewUrl);
      }
      state.keepColorsPreviewUrl = null;
    },
  },
});

export const {
  setOpencvPreviewUrl,
  setShowOpencvPreview,
  clearOpencvPreviewUrl,
  setOpencvClickMode,
  setSelectedColors,
  addSelectedColor,
  removeSelectedColor,
  setBboxDims,
  setKeepColorsPreviewUrl,
  clearKeepColorsPreviewUrl,
} = opencvSlice.actions;

export default opencvSlice.reducer;
