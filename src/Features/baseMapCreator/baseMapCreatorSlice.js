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
  blueprintScale: "",
  baseMapName: "",
  oneBaseMapPerPage: false,
  creating: false,
  //
  tempBaseMaps: [],
  //
  sourceContainerId: null,
  sourceContentArea: null,
  sourcePageId: null,
  sourcePortfolioId: null,
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
    setBlueprintScale: (state, action) => {
      state.blueprintScale = action.payload;
    },
    setBaseMapName: (state, action) => {
      state.baseMapName = action.payload;
    },
    setOneBaseMapPerPage: (state, action) => {
      state.oneBaseMapPerPage = action.payload;
    },
    setCreating: (state, action) => {
      state.creating = action.payload;
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
    },
    setTempBaseMaps: (state, action) => {
      state.tempBaseMaps = action.payload;
    },
    setSourceContainer: (state, action) => {
      const { containerId, contentArea, pageId, portfolioId } = action.payload || {};
      state.sourceContainerId = containerId ?? null;
      state.sourceContentArea = contentArea ?? null;
      state.sourcePageId = pageId ?? null;
      state.sourcePortfolioId = portfolioId ?? null;
    },
    clearSourceContainer: (state) => {
      state.sourceContainerId = null;
      state.sourceContentArea = null;
      state.sourcePageId = null;
      state.sourcePortfolioId = null;
    },
  },
});

export const {
  setPdfImageUrl,
  setOpenBaseMapCreator,
  setPdfFile,
  setPageNumber,
  setRotate,
  setBboxInRatio,
  setBlueprintScale,
  setBaseMapName,
  setOneBaseMapPerPage,
  setCreating,
  addTempBaseMap,
  removeTempBaseMap,
  updateTempBaseMap,
  setTempBaseMaps,
  setSourceContainer,
  clearSourceContainer,
} = baseMapCreatorSlice.actions;

export default baseMapCreatorSlice.reducer;
