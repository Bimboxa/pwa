import { createSlice } from "@reduxjs/toolkit";

const resourcesInitialState = {
  // Resource opened in the RESOURCES right panel (list click, or programmatic
  // open from the "Voir le détail" button of a DETAIL annotation).
  selectedResourceId: null,
  // One-shot navigation target for the PDF viewer: {pageNumber, rotation} —
  // consumed then cleared by ViewerPdfPages.
  targetPdfPage: null,
};

export const resourcesSlice = createSlice({
  name: "resources",
  initialState: resourcesInitialState,
  reducers: {
    setSelectedResourceId: (state, action) => {
      state.selectedResourceId = action.payload;
    },
    setTargetPdfPage: (state, action) => {
      state.targetPdfPage = action.payload;
    },
    openResourceAtPage: (state, action) => {
      const { resourceId, pageNumber, rotation } = action.payload ?? {};
      state.selectedResourceId = resourceId ?? null;
      state.targetPdfPage = { pageNumber: pageNumber ?? 1, rotation };
    },
  },
});

export const { setSelectedResourceId, setTargetPdfPage, openResourceAtPage } =
  resourcesSlice.actions;

export default resourcesSlice.reducer;
