import { createSlice } from "@reduxjs/toolkit";

const photoPlansInitialState = {
  // db trigger tick — bump after any db.photoPlans write so useLiveQuery
  // consumers (usePhotoPlans, useAnnotationsV2) re-run.
  photoPlansUpdatedAt: null,
  // Map-editor photoPlan focus (chips band over a photo baseMap): the
  // selected plan gets a highlight mask (rest of the photo blurred).
  selectedPhotoPlanIdInMap: null,
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
    },
    setShowGuideLinesInMap: (state, action) => {
      state.showGuideLinesInMap = action.payload;
    },
  },
});

export const {
  triggerPhotoPlansUpdate,
  setSelectedPhotoPlanIdInMap,
  setShowGuideLinesInMap,
} = photoPlansSlice.actions;

export default photoPlansSlice.reducer;
