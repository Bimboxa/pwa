import { createSlice } from "@reduxjs/toolkit";

const baseMapViewsInitialState = {
  //
  selectedBaseMapViewId: null,
  selectedBaseMapViewIdInEditor: null,
  isCreatingBaseMapView: false,
  //
  editedBaseMapView: null,
};

export const baseMapViewsSlice = createSlice({
  name: "baseMapViews",
  initialState: baseMapViewsInitialState,
  reducers: {
    setBaseMapViewsById: (state, action) => {
      const baseMapViews = action.payload;
      state.baseMapViewsById = getItemsByKey(baseMapViews, "id");
    },
    //
    triggerBaseMapViewsUpdate: (state) => {
      state.baseMapViewsUpdatedAt = Date.now();
    },
    //
    setSelectedBaseMapViewId: (state, action) => {
      state.selectedBaseMapViewId = action.payload;
    },
    setIsCreatingBaseMapView: (state, action) => {
      state.isCreatingBaseMapView = action.payload;
    },
    setEditedBaseMapView: (state, action) => {
      state.editedBaseMapView = action.payload;
    },
    //
    setSelectedBaseMapViewIdInEditor: (state, action) => {
      state.selectedBaseMapViewIdInEditor = action.payload;
    },
  },
});

export const {
  setBaseMapViewsById,
  //
  setSelectedBaseMapViewId,
  triggerBaseMapViewsUpdate,
  //
  createMap,
  updateMap,
  //
  setIsCreatingBaseMapView,
  setEditedBaseMapView,
  //
  setSelectedBaseMapViewIdInEditor,
} = baseMapViewsSlice.actions;

export default baseMapViewsSlice.reducer;
