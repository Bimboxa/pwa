import { createSlice } from "@reduxjs/toolkit";

const resourcesInitialState = {
  // DETAIL annotationTemplate used when a PDF page from the resources panel
  // is drag-n-dropped on the 2D editor: the drop creates a DETAIL annotation
  // linked to that template, with folio = the dropped page.
  selectedDetailTemplateId: null,
};

export const resourcesSlice = createSlice({
  name: "resources",
  initialState: resourcesInitialState,
  reducers: {
    setSelectedDetailTemplateId: (state, action) => {
      state.selectedDetailTemplateId = action.payload;
    },
  },
});

export const { setSelectedDetailTemplateId } = resourcesSlice.actions;

export default resourcesSlice.reducer;
