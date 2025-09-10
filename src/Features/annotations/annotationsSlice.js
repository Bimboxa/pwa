import { createSlice } from "@reduxjs/toolkit";
import theme from "Styles/theme";

//import demoAnnotation from "./data/demoAnnotation";

const annotationsInitialState = {
  //
  annotationsUpdatedAt: null,
  //
  selectedAnnotationId: null,
  //
  newAnnotation: {}, // props used when adding a annotation
  editedAnnotation: null,
  isEditingAnnotation: false,
  //
};

export const annotationsSlice = createSlice({
  name: "annotations",
  initialState: annotationsInitialState,
  reducers: {
    setSelectedAnnotationId: (state, action) => {
      state.selectedAnnotationId = action.payload;
    },
    //
    createAnnotation: (state, action) => {
      const annotation = action.payload;
      state.annotationsMap[annotation.id] = annotation;
      state.annotationsUpdatedAt = Date.now();
    },
    //
    triggerAnnotationsUpdate: (state, action) => {
      state.annotationsUpdatedAt = Date.now();
    },
    //
    setNewAnnotation: (state, action) => {
      state.newAnnotation = action.payload;
    },
    setEditedAnnotation: (state, action) => {
      state.editedAnnotation = action.payload;
    },
    setIsEditingAnnotation: (state, action) => {
      state.isEditingAnnotation = action.payload;
    },
  },
});

export const {
  setSelectedAnnotationId,
  triggerAnnotationsUpdate,
  //
  createAnnotation,
  //
  setNewAnnotation,
  setEditedAnnotation,
  setIsEditingAnnotation,
} = annotationsSlice.actions;

export default annotationsSlice.reducer;
