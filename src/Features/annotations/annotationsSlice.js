import { createSlice } from "@reduxjs/toolkit";
import theme from "Styles/theme";

//import demoAnnotation from "./data/demoAnnotation";

const annotationsInitialState = {
  //
  annotationsUpdatedAt: null,
  annotationTemplatesUpdatedAt: null,
  //
  selectedAnnotationTemplateId: null,
  //
  newAnnotation: {
    fillColor: theme.palette.secondary.main,
    strokeColor: theme.palette.secondary.main,
    fillOpacity: 0.6,
    strokeOpacity: 0.8,
    strokeWidth: 1,
    strokeWidthUnit: "PX",
  },
  // props used when adding a annotation
  editedAnnotation: null,
  isEditingAnnotation: false,
  //
  annotationTemplatesById: {}, // {id:MARKER_#234513_square,label}
  tempAnnotationTemplateLabel: null,
  //
  editedAnnotationTemplate: null, // used to update annotation template
  //
  tempAnnotations: [],
  //
  openDialogDeleteSelectedAnnotation: false,
  openDialogSaveTempAnnotations: false,
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
    triggerAnnotationsUpdate: (state) => {
      state.annotationsUpdatedAt = Date.now();
    },
    triggerAnnotationTemplatesUpdate: (state) => {
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
    setEditedAnnotationTemplate: (state, action) => {
      state.editedAnnotationTemplate = action.payload;
    },

    // temp annotations
    setTempAnnotations: (state, action) => {
      state.tempAnnotations = action.payload;
    },
    updateTempAnnotation: (state, action) => {
      const { id, ...props } = action.payload;
      const tempAnnotation = state.tempAnnotations.find((a) => a.id === id);
      if (tempAnnotation) {
        Object.assign(tempAnnotation, props);
      }
    },
    //
    setOpenDialogDeleteSelectedAnnotation: (state, action) => {
      state.openDialogDeleteSelectedAnnotation = action.payload;
    },
    setOpenDialogSaveTempAnnotations: (state, action) => {
      state.openDialogSaveTempAnnotations = action.payload;
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
  setEditedAnnotationTemplate,
  //
  setTempAnnotations,
  updateTempAnnotation,
  //
  setOpenDialogDeleteSelectedAnnotation,
  setOpenDialogSaveTempAnnotations,
} = annotationsSlice.actions;

export default annotationsSlice.reducer;
