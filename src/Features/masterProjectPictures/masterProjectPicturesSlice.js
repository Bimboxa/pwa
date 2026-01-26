import { createSlice } from "@reduxjs/toolkit";

const masterProjectPicturesInitialState = {
  picturesByProjectIdMaster: {},
  picturesUpdatedAt: null,
};

export const masterProjectPicturesSlice = createSlice({
  name: "masterProjectsPictures",
  initialState: masterProjectPicturesInitialState,
  reducers: {
    addPicturesToProject: (state, action) => {
      const { idMaster, pictures } = action.payload;
      state.picturesByProjectIdMaster[idMaster] = pictures;
      state.picturesUpdatedAt = Date.now();
    },
  },
});

export const {
  addPicturesToProject,
} = masterProjectPicturesSlice.actions;

export default masterProjectPicturesSlice.reducer;
