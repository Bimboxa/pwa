import { createSlice } from "@reduxjs/toolkit";

const viewersInitialState = {
  // The left-band selection is a MODULE key ("MAP" = Dessin, "THREED",
  // "BASE_MAPS", "PORTFOLIO", ...). Kept named selectedViewerKey to avoid a
  // big-bang rename of its many consumers.
  selectedViewerKey: "MAP",
  // Active editor inside multi-editor modules (generalizes pov.viewerMode):
  // the Dessin module can display the 2D map editor or the 3D editor.
  editorKeyByModule: { MAP: "MAP" }, // MAP: "MAP" | "THREED"
  viewerReturnContext: null, // { fromViewer, portfolioId, listingId, ... }
};

export const viewersSlice = createSlice({
  name: "viewers",
  initialState: viewersInitialState,
  reducers: {
    setSelectedViewerKey: (state, action) => {
      state.selectedViewerKey = action.payload;
    },
    setModuleEditorKey: (state, action) => {
      const { moduleKey, editorKey } = action.payload;
      state.editorKeyByModule[moduleKey] = editorKey;
    },
    setViewerReturnContext: (state, action) => {
      state.viewerReturnContext = action.payload;
    },
  },
});

export const {
  setSelectedViewerKey,
  setModuleEditorKey,
  setViewerReturnContext,
  //
} = viewersSlice.actions;

export default viewersSlice.reducer;
