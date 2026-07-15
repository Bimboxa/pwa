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
  editedBaseMap: null,
  // Enhanced image results (background fetch results)
  enhancedImageResults: {}, // { [baseMapId]: { blob, objectUrl, completedAt } }
  enhancedImageErrors: {}, // { [baseMapId]: { error, failedAt } }
  enhancingBaseMapIds: {}, // { [baseMapId]: {transformId, isEnhancing} } - tracks which baseMaps are currently being enhanced
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
      const { baseMapId, isEnhancing, transformId } = action.payload;
      if (isEnhancing) {
        // clean
        delete state.enhancedImageResults[baseMapId];
        delete state.enhancedImageErrors[baseMapId];
        if (state.enhancedImageResults[baseMapId]?.objectUrl) {
          URL.revokeObjectURL(state.enhancedImageResults[baseMapId].objectUrl);
        }

        // update 
        state.enhancingBaseMapIds[baseMapId] = { isEnhancing: true, transformId };

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
  extraReducers: (builder) => {
    // Switching the MAIN baseMap drops the properties-panel override (set by
    // clicking a baseMap plane in the 3D viewer) so useSelectedBaseMap
    // consumers fall back to the new main baseMap. Matched by type string to
    // avoid importing mapEditorSlice.
    builder.addMatcher(
      (action) => action.type === "mapEditors/setSelectedMainBaseMapId",
      (state) => {
        state.selectedBaseMapId = null;
      }
    );
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
