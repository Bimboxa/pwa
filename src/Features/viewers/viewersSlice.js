import { createSlice } from "@reduxjs/toolkit";

import getInitSelectedModuleKey from "Features/init/services/getInitSelectedModuleKey";
import setInitSelectedModuleKey from "Features/init/services/setInitSelectedModuleKey";
import getInitEditorKeyByModule from "Features/init/services/getInitEditorKeyByModule";
import setInitEditorKeyByModule from "Features/init/services/setInitEditorKeyByModule";

const viewersInitialState = {
  // The left-band selection is a MODULE key ("MAP" = Dessin, "THREED",
  // "BASE_MAPS", "PORTFOLIO", ...). Kept named selectedViewerKey to avoid a
  // big-bang rename of its many consumers. Restored from localStorage so a
  // page refresh reopens the last visited module (the scope-change landing
  // lives in useLandingViewerModuleOnScopeOpen).
  selectedViewerKey: getInitSelectedModuleKey() ?? "MAP",
  // Active editor inside multi-editor modules (generalizes pov.viewerMode):
  // the Dessin, Viewer and Zones modules can display the 2D map editor or the
  // 3D editor. THREED and ZONES are seeded so selectEffectiveViewerKey never
  // falls back to the module key (the Viewer and Zones modules' 2D editor is
  // the shared "MAP" instance, not their own key). Restored from localStorage
  // (the getter always merges over the seeded defaults).
  editorKeyByModule: getInitEditorKeyByModule(),
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
  // Freshly created scope: land on the Dessin module (2D editor) instead of
  // the Viewer — set by the scope creation flows, cleared when the scope
  // selection moves away.
  landOnDrawScopeId: null,
};

export const viewersSlice = createSlice({
  name: "viewers",
  initialState: viewersInitialState,
  reducers: {
    setSelectedViewerKey: (state, action) => {
      state.selectedViewerKey = action.payload;
      setInitSelectedModuleKey(action.payload);
    },
    setModuleEditorKey: (state, action) => {
      const { moduleKey, editorKey } = action.payload;
      state.editorKeyByModule[moduleKey] = editorKey;
      setInitEditorKeyByModule({ ...state.editorKeyByModule });
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
    setLandOnDrawScopeId: (state, action) => {
      state.landOnDrawScopeId = action.payload ?? null;
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
  setLandOnDrawScopeId,
  //
} = viewersSlice.actions;

export default viewersSlice.reducer;
