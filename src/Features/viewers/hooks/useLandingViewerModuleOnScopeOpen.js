import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { useSearchParams } from "react-router-dom";

import { setModuleEditorKey, setSelectedViewerKey } from "../viewersSlice";

import getInitScopeId from "Features/init/services/getInitScopeId";
import { isThreedFamilyViewerKey } from "../utils/threedViewerKeys";

// Last scope whose landing was applied. Module-scoped so it survives
// LayoutDesktop remounts (dashboard round-trips); initialized from the
// persisted scope so a page refresh — same scope — restores the last visited
// module/editor (seeded from localStorage in viewersSlice) instead of
// re-landing on the Viewer. Must be read at import time, before any
// setSelectedScopeId dispatch rewrites initScopeId.
let lastLandedScopeId = getInitScopeId();

export default function useLandingViewerModuleOnScopeOpen() {
  const dispatch = useDispatch();
  const store = useStore();

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  // A freshly created scope lands on the Dessin module (2D editor) — the
  // Viewer landing is for reopening scopes that already have content.
  const landOnDrawScopeId = useSelector((s) => s.viewers.landOnDrawScopeId);
  const isNewScopeDrawLanding =
    Boolean(landOnDrawScopeId) && landOnDrawScopeId === selectedScopeId;

  // honor ?viewer=3d deep link: don't reset the viewer to MAP when 3D is requested
  const [searchParams] = useSearchParams();
  const wants3dViewer = searchParams.get("viewer") === "3d";

  // effects

  useEffect(() => {
    if (!selectedScopeId) return;
    const isNewScope = selectedScopeId !== lastLandedScopeId;
    lastLandedScopeId = selectedScopeId;

    if (disable3D) {
      // Correction only (config may settle after the first render): leave
      // non-3D modules — restored or user-chosen — alone.
      if (isThreedFamilyViewerKey(store.getState().viewers.selectedViewerKey)) {
        dispatch(setSelectedViewerKey("MAP"));
      }
    } else if (!wants3dViewer) {
      if (isNewScopeDrawLanding) {
        // Freshly created scope: straight to drawing.
        dispatch(setSelectedViewerKey("MAP"));
        dispatch(setModuleEditorKey({ moduleKey: "MAP", editorKey: "MAP" }));
      } else if (isNewScope) {
        // Default landing module on scope change: the Dessin module, always
        // on its 2D editor even if the module was left on another editor
        // earlier in the session. Skipped on refresh / same-scope reopen,
        // where the previous context is kept.
        dispatch(setSelectedViewerKey("MAP"));
        dispatch(setModuleEditorKey({ moduleKey: "MAP", editorKey: "MAP" }));
      }
    }
    // selectedViewerKey is read via store.getState() and stays out of the
    // deps on purpose: re-running on every module switch would re-land.
  }, [
    selectedScopeId,
    wants3dViewer,
    disable3D,
    isNewScopeDrawLanding,
    dispatch,
  ]);
}
