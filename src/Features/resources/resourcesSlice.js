import { createSlice } from "@reduxjs/toolkit";

const resourcesInitialState = {
  // DETAIL annotationTemplate used when a PDF page from the resources panel
  // is drag-n-dropped on the 2D editor: the drop creates a DETAIL annotation
  // linked to that template, with folio = the dropped page.
  selectedDetailTemplateId: null,
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
    setSelectedDetailTemplateId: (state, action) => {
      state.selectedDetailTemplateId = action.payload;
    },
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

export const {
  setSelectedDetailTemplateId,
  setSelectedResourceId,
  setTargetPdfPage,
  openResourceAtPage,
} = resourcesSlice.actions;

export default resourcesSlice.reducer;
