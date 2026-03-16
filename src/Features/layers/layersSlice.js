import { createSlice } from "@reduxjs/toolkit";

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
});

export const {
  setActiveLayerId,
  toggleLayerVisibility,
  toggleShowAnnotationsWithoutLayer,
  triggerLayersUpdate,
} = layersSlice.actions;

export default layersSlice.reducer;
