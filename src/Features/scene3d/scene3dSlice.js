import { createSlice } from "@reduxjs/toolkit";

const scene3dInitialState = {
  // Import dialog of the SCENE_3D annotations (3D scans). null = closed.
  //   {draftProps, drawingMode}: opened by ARMING the tool — once the scan
  //     is imported the draft is armed with its descriptor and the click
  //     places it;
  //   {annotationId}: "Recharger les fichiers" of an existing annotation
  //     whose scan data is not on this device.
  importDialog: null,
};

export const scene3dSlice = createSlice({
  name: "scene3d",
  initialState: scene3dInitialState,
  reducers: {
    openScene3dImportDialog: (state, action) => {
      state.importDialog = action.payload ?? null;
    },
    closeScene3dImportDialog: (state) => {
      state.importDialog = null;
    },
  },
});

export const { openScene3dImportDialog, closeScene3dImportDialog } =
  scene3dSlice.actions;

export default scene3dSlice.reducer;
