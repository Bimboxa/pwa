import { createSlice } from "@reduxjs/toolkit";
import theme from "Styles/theme";

//import demoAnnotation from "./data/demoAnnotation";

const annotationsInitialState = {
  //
  annotationsUpdatedAt: null,
  annotationTemplatesUpdatedAt: null,
  //
  selectedAnnotationId: null,
  //
  newAnnotation: {}, // props used when adding a annotation
  editedAnnotation: null,
  isEditingAnnotation: false,
  //
  annotationTemplatesById: {}, // {id:MARKER_#234513_square,label}
  tempAnnotationTemplateLabel: null,
  //
  editedAnnotationTemplate: null, // used to update annotation template
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
    triggerAnnotationTemplatesUpdate: (state, action) => {
      state.annotationTemplatesUpdatedAt = Date.now();
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

    // annotation templates
    setAnnotationTemplatesById: (state, action) => {
      state.annotationTemplatesById = action.payload;
    },
    setTempAnnotationTemplateLabel: (state, action) => {
      state.tempAnnotationTemplateLabel = action.payload;
    },
  },
});

export const {
  setSelectedAnnotationId,
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
  //
  createAnnotation,
  //
  setNewAnnotation,
  setEditedAnnotation,
  setIsEditingAnnotation,
  //
  setTempAnnotationTemplateLabel,
} = annotationsSlice.actions;

export default annotationsSlice.reducer;
