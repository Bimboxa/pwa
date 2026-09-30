import { createSlice } from "@reduxjs/toolkit";

import getInitSelectedModuleKey from "Features/init/services/getInitSelectedModuleKey";
import setInitSelectedModuleKey from "Features/init/services/setInitSelectedModuleKey";
import getInitEditorKeyByModule from "Features/init/services/getInitEditorKeyByModule";
import setInitEditorKeyByModule from "Features/init/services/setInitEditorKeyByModule";
import getInitScopeVisibility from "Features/init/services/getInitScopeVisibility";

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
  // 2D map editors: hide the main baseMap image entirely (toggled from the
  // top-bar baseMap selector's eye, and from the main row's eye in the base
  // maps list). Per-scope local state: saved to localStorage by
  // scopeVisibilityPersistMiddleware, restored on scope selection.
  hideBaseMapImageInViewer: false,
  // 2D map editors: hide the annotations entirely (toggled from the count
  // badge of the top-bar baseMap selector / Viewer 2D selected chip).
  // Per-scope local state, same lifecycle as hideBaseMapImageInViewer.
  hideAnnotationsInViewer: false,
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
    setHideBaseMapImageInViewer: (state, action) => {
      state.hideBaseMapImageInViewer = Boolean(action.payload);
    },
    setHideAnnotationsInViewer: (state, action) => {
      state.hideAnnotationsInViewer = Boolean(action.payload);
    },
    setInitialFitDoneForScopeId: (state, action) => {
      state.initialFitDoneForScopeId = action.payload ?? null;
    },
    setLandOnDrawScopeId: (state, action) => {
      state.landOnDrawScopeId = action.payload ?? null;
    },
  },
  extraReducers: (builder) => {
    // A baseMap hidden in one scope must not open the next one blank:
    // restore the scope's own saved toggles, else the defaults.
    builder.addCase("scopes/setSelectedScopeId", (state, action) => {
      const saved = getInitScopeVisibility(action.payload)?.viewer2d;
      state.hideBaseMapImageInViewer = Boolean(saved?.hideBaseMapImageInViewer);
      state.hideAnnotationsInViewer = Boolean(saved?.hideAnnotationsInViewer);
    });
  },
});

export const {
  setSelectedViewerKey,
  setModuleEditorKey,
  setViewerReturnContext,
  setHideBaseMapImageInViewer,
  setHideAnnotationsInViewer,
  setInitialFitDoneForScopeId,
  setLandOnDrawScopeId,
  //
} = viewersSlice.actions;

export default viewersSlice.reducer;
