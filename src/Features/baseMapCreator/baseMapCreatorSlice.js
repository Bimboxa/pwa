import { createSlice } from "@reduxjs/toolkit";
import theme from "Styles/theme";

//import demoMarker from "./data/demoMarker";

const baseMapCreatorInitialState = {
  open: false,
  //
  pdfFile: null,
  pdfImageUrl: null,
  //
  pageNumber: 1,
  rotate: 0, // rotation angle in deg 0 - 90 - 180 - 270
  bboxInRatio: {
    x1: 0,
    y1: 0,
    x2: 1,
    y2: 1,
  },
  //
  tempBaseMaps: [],
};

export const baseMapCreatorSlice = createSlice({
  name: "baseMapCreator",
  initialState: baseMapCreatorInitialState,
  reducers: {
    setOpenBaseMapCreator: (state, action) => {
      state.open = action.payload;
    },
    setPdfFile: (state, action) => {
      state.pdfFile = action.payload;
    },
    setPdfImageUrl: (state, action) => {
      state.pdfImageUrl = action.payload;
    },
    setPageNumber: (state, action) => {
      state.pageNumber = action.payload;
    },
    setRotate: (state, action) => {
      state.rotate = action.payload;
    },
    setBboxInRatio: (state, action) => {
      state.bboxInRatio = action.payload;
    },
    addTempBaseMap: (state, action) => {
      state.tempBaseMaps.push(action.payload);
    },
    removeTempBaseMap: (state, action) => {
      state.tempBaseMaps = state.tempBaseMaps.filter((baseMap) => baseMap.id !== action.payload.id);
    },
    updateTempBaseMap: (state, action) => {
      const { id, updates } = action.payload;
      const index = state.tempBaseMaps.findIndex((baseMap) => baseMap.id === id);
      if (index !== -1) {
        state.tempBaseMaps[index] = { ...state.tempBaseMaps[index], ...updates };
      }
    }
  },
});

export const {
  setPdfImageUrl,
  setOpenBaseMapCreator,
  setPdfFile,
  setPageNumber,
  setRotate,
  setBboxInRatio,
  addTempBaseMap,
  removeTempBaseMap,
  updateTempBaseMap
} = baseMapCreatorSlice.actions;

export default baseMapCreatorSlice.reducer;
