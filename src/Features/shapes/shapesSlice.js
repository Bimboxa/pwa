import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";

// import randomShapesMap from "./data/randomShapesMap";
//import demoShape from "./data/demoShape";

import theme from "Styles/theme";

const shapesInitialState = {
  //
  shapesMap: {},
  shapesUpdatedAt: null,
  //
  selectedShapeId: null,
  //
  newShape: {
    color: theme.palette.shape.default,
    label: "XXX",
  },
  editedShape: null,
  isEditingShape: false,
};

export const shapeEditorSlice = createSlice({
  name: "shapes",
  initialState: shapesInitialState,
  reducers: {
    setSelectedShapeId: (state, action) => {
      state.selectedShapeId = action.payload;
    },
    triggerShapesUpdate: (state) => {
      state.shapesUpdatedAt = Date.now();
    },
    //
    setNewShape: (state, action) => {
      state.newShape = action.payload;
    },
    setEditedShape: (state, action) => {
      state.editedShape = action.payload;
    },
    setIsEditingShape: (state, action) => {
      state.isEditingShape = action.payload;
    },
    createShape: (state, action) => {
      const shape = action.payload;
      state.shapesMap[shape.id] = shape;
    },
    updateShape: (state, action) => {
      const updates = action.payload;
      const oldShape = state.shapesMap[updates.id];
      state.shapesMap[updates.id] = {...oldShape, ...updates};
    },
  },
});

export const {
  setSelectedShapeId,
  triggerShapesUpdate,
  //
  setNewShape,
  setEditedShape,
  setIsEditingShape,
  //
  createShape,
  updateShape,
  //
} = shapeEditorSlice.actions;

export default shapeEditorSlice.reducer;
