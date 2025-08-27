import { createSlice } from "@reduxjs/toolkit";

const baseMapViewsInitialState = {
  baseMapViewsUpdatedAt: null,
  //
  selectedBaseMapViewId: null,
  selectedBaseMapViewIdInEditor: null,
  //
  isCreatingBaseMapView: false,
  isEditingBaseMapView: false,
  editedBaseMapView: null,

  // tempProps : used to update temp props while modifying the view in the mapEditor.

  tempProps: {
    bgImage: null,
  },
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
    setIsEditingBaseMapView: (state, action) => {
      state.isEditingBaseMapView = action.payload;
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
  triggerBaseMapViewsUpdate,
  //
  setBaseMapViewsById,
  //
  setSelectedBaseMapViewId,
  //
  createMap,
  updateMap,
  //
  setIsCreatingBaseMapView,
  setIsEditingBaseMapView,
  setEditedBaseMapView,
  //
  setSelectedBaseMapViewIdInEditor,
} = baseMapViewsSlice.actions;

export default baseMapViewsSlice.reducer;
