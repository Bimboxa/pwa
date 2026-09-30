import { createSlice } from "@reduxjs/toolkit";

const scene3dInitialState = {
  // "Recharger les fichiers" of a scan base map whose scan data is not on
  // this device: {baseMapId} | null (closed). The creation flow itself is a
  // local dialog of the base map creation section.
  reloadDialog: null,
};

export const scene3dSlice = createSlice({
  name: "scene3d",
  initialState: scene3dInitialState,
  reducers: {
    openScene3dReloadDialog: (state, action) => {
      state.reloadDialog = action.payload ?? null;
    },
    closeScene3dReloadDialog: (state) => {
      state.reloadDialog = null;
    },
  },
});

export const { openScene3dReloadDialog, closeScene3dReloadDialog } =
  scene3dSlice.actions;

export default scene3dSlice.reducer;
