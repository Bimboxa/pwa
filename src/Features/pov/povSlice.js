import { createSlice } from "@reduxjs/toolkit";

const povInitialState = {
  viewerMode: "MAP", // "MAP" | "THREED" — editor shown inside the POINT_OF_VIEW viewer
  // Description typed in the "Nouveau point de vue" panel before the view
  // exists; consumed (then cleared) by the next "Créer une vue".
  draftDescription: "",
  // "Amélioration IA": when on, "Créer une vue" also sends the capture to the
  // image-transformation endpoint (usedByPov prompt) and shows the result in
  // a comparison dialog.
  aiEnhanceEnabled: false,
};

export const povSlice = createSlice({
  name: "pov",
  initialState: povInitialState,
  reducers: {
    setPovViewerMode: (state, action) => {
      state.viewerMode = action.payload;
    },
    setPovDraftDescription: (state, action) => {
      state.draftDescription = action.payload ?? "";
    },
    setPovAiEnhanceEnabled: (state, action) => {
      state.aiEnhanceEnabled = Boolean(action.payload);
    },
  },
});

export const {
  setPovViewerMode,
  setPovDraftDescription,
  setPovAiEnhanceEnabled,
} = povSlice.actions;

export default povSlice.reducer;
