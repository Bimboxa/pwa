import { createSlice } from "@reduxjs/toolkit";
import getInitScopeVisibility from "Features/init/services/getInitScopeVisibility";

const layersSlice = createSlice({
  name: "layers",
  initialState: {
    activeLayerId: null,
    hiddenLayerIds: [],
    showAnnotationsWithoutLayer: true,
    layersUpdatedAt: null,
  },
  reducers: {
    setActiveLayerId(state, action) {
      state.activeLayerId = action.payload;
    },
    hideLayerIds(state, action) {
      state.hiddenLayerIds = [
        ...new Set([...state.hiddenLayerIds, ...action.payload]),
      ];
    },
    toggleLayerVisibility(state, action) {
      const layerId = action.payload;
      if (state.hiddenLayerIds.includes(layerId)) {
        state.hiddenLayerIds = state.hiddenLayerIds.filter(
          (id) => id !== layerId
        );
      } else {
        state.hiddenLayerIds = [...state.hiddenLayerIds, layerId];
      }
    },
    toggleShowAnnotationsWithoutLayer(state) {
      state.showAnnotationsWithoutLayer = !state.showAnnotationsWithoutLayer;
    },
    triggerLayersUpdate(state) {
      state.layersUpdatedAt = Date.now();
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      (action) => action.type === "scopes/setSelectedScopeId",
      (state, action) => {
        state.activeLayerId = null;
        state.hiddenLayerIds =
          getInitScopeVisibility(action.payload)?.hiddenLayerIds ?? [];
      }
    );
  },
});

export const {
  setActiveLayerId,
  hideLayerIds,
  toggleLayerVisibility,
  toggleShowAnnotationsWithoutLayer,
  triggerLayersUpdate,
} = layersSlice.actions;

export default layersSlice.reducer;
