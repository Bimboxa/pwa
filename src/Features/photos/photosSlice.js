import { createSlice } from "@reduxjs/toolkit";

const photosInitialState = {
  // Album (PHOTO listing) displayed in the Photos left panel.
  selectedListingId: null,
  // Photo highlighted in the grid (also set when clicking a photo node on
  // the map).
  selectedPhotoId: null,
  // Photo whose detail subview (large image + prev/next arrows) is open.
  detailPhotoId: null,
  // Photo being localized on the map: armed together with the "PHOTO_POSE"
  // drawing mode by the "Localiser la photo" button, cleared at commit or
  // when the drawing mode is left (Escape / tool change).
  localizingPhotoId: null,
};

export const photosSlice = createSlice({
  name: "photos",
  initialState: photosInitialState,
  reducers: {
    setSelectedPhotoListingId: (state, action) => {
      state.selectedListingId = action.payload ?? null;
    },
    setSelectedPhotoId: (state, action) => {
      state.selectedPhotoId = action.payload ?? null;
    },
    setDetailPhotoId: (state, action) => {
      state.detailPhotoId = action.payload ?? null;
    },
    setLocalizingPhotoId: (state, action) => {
      state.localizingPhotoId = action.payload ?? null;
    },
  },
});

export const {
  setSelectedPhotoListingId,
  setSelectedPhotoId,
  setDetailPhotoId,
  setLocalizingPhotoId,
} = photosSlice.actions;

export default photosSlice.reducer;
