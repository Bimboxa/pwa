import { createSlice } from "@reduxjs/toolkit";

import demoMap from "./data/demoMap";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

const baseMapsInitialState = {
  baseMapsById: null,
  //
  baseMapsMap: { demo: demoMap },
  baseMapsUpdatedAt: null,
  //
  selectedBaseMapId: null,
  isCreatingBaseMap: false,
  // Enhanced image results (background fetch results)
  enhancedImageResults: {}, // { [baseMapId]: { blob, objectUrl, completedAt } }
  enhancedImageErrors: {}, // { [baseMapId]: { error, failedAt } }
  enhancingBaseMapIds: {}, // { [baseMapId]: true } - tracks which baseMaps are currently being enhanced
};

export const baseMapsSlice = createSlice({
  name: "baseMaps",
  initialState: baseMapsInitialState,
  reducers: {
    setBaseMapsById: (state, action) => {
      const baseMaps = action.payload;
      state.baseMapsById = getItemsByKey(baseMaps, "id");
    },
    //
    triggerBaseMapsUpdate: (state) => {
      state.baseMapsUpdatedAt = Date.now();
    },
    //
    setSelectedBaseMapId: (state, action) => {
      state.selectedBaseMapId = action.payload;
    },
    setIsCreatingBaseMap: (state, action) => {
      state.isCreatingBaseMap = action.payload;
    },
    setEditedBaseMap: (state, action) => {
      state.editedBaseMap = action.payload;
    },
    setEnhancedImageResult: (state, action) => {
      const { baseMapId, blob, objectUrl, completedAt } = action.payload;
      state.enhancedImageResults[baseMapId] = {
        blob,
        objectUrl,
        completedAt,
      };
      // Clear any previous error for this baseMap
      delete state.enhancedImageErrors[baseMapId];
      // Clear loading state
      delete state.enhancingBaseMapIds[baseMapId];
    },
    setEnhancedImageError: (state, action) => {
      const { baseMapId, error, failedAt } = action.payload;
      state.enhancedImageErrors[baseMapId] = { error, failedAt };
      // Clear loading state
      delete state.enhancingBaseMapIds[baseMapId];
    },
    setEnhancingBaseMap: (state, action) => {
      const { baseMapId, isEnhancing } = action.payload;
      if (isEnhancing) {
        state.enhancingBaseMapIds[baseMapId] = true;
      } else {
        delete state.enhancingBaseMapIds[baseMapId];
      }
    },
    clearEnhancedImageResult: (state, action) => {
      const baseMapId = action.payload;
      if (state.enhancedImageResults[baseMapId]?.objectUrl) {
        URL.revokeObjectURL(state.enhancedImageResults[baseMapId].objectUrl);
      }
      delete state.enhancedImageResults[baseMapId];
      delete state.enhancedImageErrors[baseMapId];
    },
  },
});

export const {
  setBaseMapsById,
  //
  setSelectedBaseMapId,
  triggerBaseMapsUpdate,
  //
  createMap,
  updateMap,
  //
  setIsCreatingBaseMap,
  setEditedBaseMap,
  //
  setEnhancedImageResult,
  setEnhancedImageError,
  clearEnhancedImageResult,
  setEnhancingBaseMap,
} = baseMapsSlice.actions;

export default baseMapsSlice.reducer;
