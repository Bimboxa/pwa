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
  },
});

export const {
  setSelectedShapeId,
  triggerShapesUpdate,
  //
} = shapeEditorSlice.actions;

export default shapeEditorSlice.reducer;
