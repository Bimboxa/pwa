import { createSlice } from "@reduxjs/toolkit";
import theme from "Styles/theme";

//import demoAnnotation from "./data/demoAnnotation";

const annotationsInitialState = {
  //
  annotationsMap: {},
  annotationsUpdatedAt: null,
  //
  annotationsUpdatedAt: null,
  //
  selectedAnnotationId: null,
  //
  newAnnotation: {}, // props used when adding a annotation
  editedAnnotation: null,
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
  },
});

export const {
  setSelectedAnnotationId,
  triggerAnnotationsUpdate,
  //
  createAnnotation,
  //
  setNewAnnotation,
} = annotationsSlice.actions;

export default annotationsSlice.reducer;
