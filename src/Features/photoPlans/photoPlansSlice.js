import { createSlice } from "@reduxjs/toolkit";

const photoPlansInitialState = {
  // db trigger tick — bump after any db.photoPlans write so useLiveQuery
  // consumers (usePhotoPlans, useAnnotationsV2) re-run.
  photoPlansUpdatedAt: null,
  // Map-editor photoPlan focus (chips band over a photo baseMap): the
  // selected plan gets a highlight mask (rest of the photo blurred), and can
  // be displayed "à plat" (read-only rectified preview overlay).
  selectedPhotoPlanIdInMap: null,
  flattenedPhotoPlanId: null,
  // Quick-flatten flow ("Transfo." tool of the BASE_MAPS module): show the
  // draggable vanishing guide lines over the photo in the main 2D editor.
  showGuideLinesInMap: false,
};

export const photoPlansSlice = createSlice({
  name: "photoPlans",
  initialState: photoPlansInitialState,
  reducers: {
    triggerPhotoPlansUpdate: (state) => {
      state.photoPlansUpdatedAt = Date.now();
    },
    setSelectedPhotoPlanIdInMap: (state, action) => {
      state.selectedPhotoPlanIdInMap = action.payload;
      // The flattened preview always shows the SELECTED plan.
      if (state.flattenedPhotoPlanId !== action.payload) {
        state.flattenedPhotoPlanId = null;
      }
    },
    setFlattenedPhotoPlanId: (state, action) => {
      state.flattenedPhotoPlanId = action.payload;
    },
    setShowGuideLinesInMap: (state, action) => {
      state.showGuideLinesInMap = action.payload;
    },
  },
});

export const {
  triggerPhotoPlansUpdate,
  setSelectedPhotoPlanIdInMap,
  setFlattenedPhotoPlanId,
  setShowGuideLinesInMap,
} = photoPlansSlice.actions;

export default photoPlansSlice.reducer;
