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
  },
});

export const {
  triggerPhotoPlansUpdate,
  setSelectedPhotoPlanIdInMap,
  setFlattenedPhotoPlanId,
} = photoPlansSlice.actions;

export default photoPlansSlice.reducer;
