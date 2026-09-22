import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { useSearchParams } from "react-router-dom";

import { setModuleEditorKey, setSelectedViewerKey } from "../viewersSlice";
import { setPovViewerMode } from "Features/pov/povSlice";

import getInitScopeId from "Features/init/services/getInitScopeId";
import { DEFAULT_EDITOR_KEY_BY_MODULE } from "Features/init/services/getInitEditorKeyByModule";
import { isThreedFamilyViewerKey } from "../utils/threedViewerKeys";

// Last scope whose landing was applied. Module-scoped so it survives
// LayoutDesktop remounts (dashboard round-trips); initialized from the
// persisted scope so a page refresh — same scope — restores the last visited
// module/editor (seeded from localStorage in viewersSlice) instead of
// re-landing on the default module. Must be read at import time, before any
// setSelectedScopeId dispatch rewrites initScopeId.
let lastLandedScopeId = getInitScopeId();

export default function useLandingViewerModuleOnScopeOpen() {
  const dispatch = useDispatch();
  const store = useStore();

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  // Device preference (Configuration > Données & préférences): the module a
  // scope lands on when opened from the dashboard. Dessin by default.
  const defaultModuleKey = useSelector(
    (s) => s.appConfig.defaultModuleKey ?? "MAP"
  );
  // A freshly created scope lands on the Dessin module (2D editor) — the
  // default-module landing is for reopening scopes that already have content.
  const landOnDrawScopeId = useSelector((s) => s.viewers.landOnDrawScopeId);
  const isNewScopeDrawLanding =
    Boolean(landOnDrawScopeId) && landOnDrawScopeId === selectedScopeId;

  // honor ?viewer=3d deep link: don't reset the viewer to MAP when 3D is requested
  const [searchParams] = useSearchParams();
  const wants3dViewer = searchParams.get("viewer") === "3d";

  // helpers

  // Lands on a module, always on its default editor (the 2D one for the
  // multi-editor modules) even if the module was left on another editor
  // earlier in the session. Single-editor modules have no entry to set.
  function landOnModule(moduleKey) {
    dispatch(setSelectedViewerKey(moduleKey));
    const editorKey = DEFAULT_EDITOR_KEY_BY_MODULE[moduleKey];
    if (editorKey) {
      dispatch(setModuleEditorKey({ moduleKey, editorKey }));
    } else if (moduleKey === "POINT_OF_VIEW") {
      // POV keeps its own editor mode until it migrates to editorKeyByModule
      // (see useSwitchViewer).
      dispatch(setPovViewerMode("MAP"));
    }
  }

  // effects

  useEffect(() => {
    if (!selectedScopeId) return;
    const isNewScope = selectedScopeId !== lastLandedScopeId;
    lastLandedScopeId = selectedScopeId;

    // With 3D disabled a 3D-family default module lands on Dessin instead.
    const landingModuleKey =
      disable3D && isThreedFamilyViewerKey(defaultModuleKey)
        ? "MAP"
        : defaultModuleKey;

    if (isNewScopeDrawLanding) {
      // Freshly created scope: straight to drawing.
      landOnModule("MAP");
    } else if (isNewScope && (!wants3dViewer || disable3D)) {
      // Default landing module on scope change (device preference), on its
      // default editor. Skipped on refresh / same-scope reopen, where the
      // previous context is kept, and on the ?viewer=3d deep link. A module
      // disabled on the opened scope is corrected by useEnsureEnabledModule
      // once scopeConfig hydrates.
      landOnModule(landingModuleKey);
    } else if (
      disable3D &&
      isThreedFamilyViewerKey(store.getState().viewers.selectedViewerKey)
    ) {
      // Correction only (config may settle after the first render): leave
      // non-3D modules — restored or user-chosen — alone.
      dispatch(setSelectedViewerKey("MAP"));
    }
    // selectedViewerKey is read via store.getState() and stays out of the
    // deps on purpose: re-running on every module switch would re-land.
  }, [
    selectedScopeId,
    wants3dViewer,
    disable3D,
    isNewScopeDrawLanding,
    defaultModuleKey,
    dispatch,
  ]);
}
