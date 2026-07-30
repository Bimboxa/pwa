import { createSlice } from "@reduxjs/toolkit";

const photoPlansInitialState = {
  // db trigger tick — bump after any db.photoPlans write so useLiveQuery
  // consumers (usePhotoPlans, useAnnotationsV2) re-run.
  photoPlansUpdatedAt: null,
};

export const photoPlansSlice = createSlice({
  name: "photoPlans",
  initialState: photoPlansInitialState,
  reducers: {
    triggerPhotoPlansUpdate: (state) => {
      state.photoPlansUpdatedAt = Date.now();
    },
  },
});

export const { triggerPhotoPlansUpdate } = photoPlansSlice.actions;

export default photoPlansSlice.reducer;
