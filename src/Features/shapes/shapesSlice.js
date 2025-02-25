import {createSlice} from "@reduxjs/toolkit";

import randomShapesMap from "./data/randomShapesMap";

const shapesInitialState = {
  //
  shapesMap: randomShapesMap,
  shapesUpdatedAt: null,
  //
  selectedShapeId: [],
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
  createShape,
  updateShape,
  //
} = shapeEditorSlice.actions;

export default shapeEditorSlice.reducer;
