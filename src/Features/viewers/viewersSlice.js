import { createSlice } from "@reduxjs/toolkit";

const viewersInitialState = {
  // The left-band selection is a MODULE key ("MAP" = Dessin, "THREED",
  // "BASE_MAPS", "PORTFOLIO", ...). Kept named selectedViewerKey to avoid a
  // big-bang rename of its many consumers.
  selectedViewerKey: "MAP",
  // Active editor inside multi-editor modules (generalizes pov.viewerMode):
  // the Dessin and Viewer modules can display the 2D map editor or the 3D
  // editor. THREED is seeded so selectEffectiveViewerKey never falls back to
  // the module key ("THREED" module without an entry would be fine, but the
  // Viewer module's 2D editor is "MAP", not its own key).
  editorKeyByModule: { MAP: "MAP", THREED: "THREED" },
  viewerReturnContext: null, // { fromViewer, portfolioId, listingId, ... }
  // Annotation-less baseMaps pinned into the Viewer module's chips band
  // (session-only, reset on scope open by useInitViewerModuleOnScopeOpen).
  pinnedBaseMapIdsInViewer: [],
  // Viewer module, 2D editor: hide the main baseMap image entirely (toggled
  // from the selected chip's eye in the chips band).
  hideBaseMapImageInViewer: false,
  // Scope whose initial top-down fit already ran (ThreedInitialFitOnLanding).
  // In redux (not a component ref) so the 2D/3D editor toggles — which
  // unmount the component — don't re-arm the fit; reset when the scope
  // closes so reopening fits again.
  initialFitDoneForScopeId: null,
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
    togglePinnedBaseMapIdInViewer: (state, action) => {
      const id = action.payload;
      const index = state.pinnedBaseMapIdsInViewer.indexOf(id);
      if (index === -1) state.pinnedBaseMapIdsInViewer.push(id);
      else state.pinnedBaseMapIdsInViewer.splice(index, 1);
    },
    setPinnedBaseMapIdsInViewer: (state, action) => {
      state.pinnedBaseMapIdsInViewer = action.payload ?? [];
    },
    setHideBaseMapImageInViewer: (state, action) => {
      state.hideBaseMapImageInViewer = Boolean(action.payload);
    },
    setInitialFitDoneForScopeId: (state, action) => {
      state.initialFitDoneForScopeId = action.payload ?? null;
    },
  },
});

export const {
  setSelectedViewerKey,
  setModuleEditorKey,
  setViewerReturnContext,
  togglePinnedBaseMapIdInViewer,
  setPinnedBaseMapIdsInViewer,
  setHideBaseMapImageInViewer,
  setInitialFitDoneForScopeId,
  //
} = viewersSlice.actions;

export default viewersSlice.reducer;
