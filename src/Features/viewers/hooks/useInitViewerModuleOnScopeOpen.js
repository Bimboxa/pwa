import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setHideBaseMapImageInViewer,
  setPinnedBaseMapIdsInViewer,
} from "../viewersSlice";
import {
  setAnnotationsModeByBaseMapIdIn3d,
  setHideMainBaseMapImageIn3d,
  setRevealOnMainSelectSuspended,
} from "Features/threedEditor/threedEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import { ANNOTATIONS_DISPLAY_MODE } from "Features/threedEditor/constants/annotationsDisplayModeIn3d";

// Scope-open seeding of the Viewer module's 3D visibility: baseMap images
// hidden (main's image eye off — non-main are already off by default) and
// annotations of EVERY annotated baseMap displayed. Runs once per scope open
// (re-armed when the scope closes back to the dashboard). Mounted in
// LayoutDesktop next to the landing effect.
export default function useInitViewerModuleOnScopeOpen() {
  const dispatch = useDispatch();

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  const isViewerModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "THREED"
  );
  const initialFitDoneForScopeId = useSelector(
    (s) => s.viewers.initialFitDoneForScopeId
  );
  const hideMainImage = useSelector(
    (s) => s.threedEditor.hideMainBaseMapImageIn3d
  );
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );
  const mainBaseMap = useMainBaseMap();
  // Same option set as useAnnotationsCountByBaseMapId (the 3D chips badges):
  // every baseMap of the project is counted, not just the visible ones.
  const annotations = useAnnotationsV2({
    caller: "useInitViewerModuleOnScopeOpen",
    filterBySelectedScope: true,
    excludeListingsIds: hiddenListingsIds,
    excludeProfileTemplates: true,
    hideBaseMapAnnotations: true,
    excludeIsForBaseMapsListings: true,
    excludeBgAnnotations: true,
    ignoreSolo: true,
  });

  // effects

  const doneImagesScopeRef = useRef(null);
  const doneAnnotationsScopeRef = useRef(null);

  useEffect(() => {
    // Dashboard round-trips null the scope: re-arm for the next open.
    if (!scopeId) {
      doneImagesScopeRef.current = null;
      doneAnnotationsScopeRef.current = null;
    }
  }, [scopeId]);

  // Landing guard — active from the very first mount until the initial
  // top-down fit closes the landing window (viewers.initialFitDoneForScopeId).
  // The persisted-main restore (setSelectedMainBaseMapId) fires at an
  // arbitrary point of the startup and its "reveal fully" extraReducer would
  // re-show the image mid-load: suspend that reveal for the whole window and
  // re-force the hide if anything flipped it back.
  const landingActive =
    !disable3D && isViewerModule && initialFitDoneForScopeId === null;

  useEffect(() => {
    dispatch(setRevealOnMainSelectSuspended(landingActive));
    if (landingActive && !hideMainImage) {
      dispatch(setHideMainBaseMapImageIn3d(true));
    }
  }, [landingActive, hideMainImage, dispatch]);

  // Images off — dispatched as soon as the scope + main baseMap are known,
  // WITHOUT waiting for the annotations: the hide must be in redux before the
  // 3D textures land, otherwise the baseMaps flash visible then hide one by
  // one (the visibility pass + ImagesManager then keep every group hidden in
  // batch, including the ones created later).
  useEffect(() => {
    if (disable3D || !scopeId || doneImagesScopeRef.current === scopeId) return;
    // Wait for the main baseMap selection to settle: setSelectedMainBaseMapId
    // resets hideMainBaseMapImageIn3d (threedEditorSlice extraReducer) and
    // must not clobber the flag set below.
    if (!mainBaseMap?.id) return;
    doneImagesScopeRef.current = scopeId;

    dispatch(setPinnedBaseMapIdsInViewer([]));
    dispatch(setHideBaseMapImageInViewer(false));
    dispatch(setHideMainBaseMapImageIn3d(true));
  }, [scopeId, disable3D, mainBaseMap?.id, dispatch]);

  // Annotations of every annotated baseMap displayed — once the annotations
  // are loaded.
  useEffect(() => {
    if (disable3D || !scopeId) return;
    if (doneAnnotationsScopeRef.current === scopeId) return;
    if (!mainBaseMap?.id) return;
    // useAnnotationsV2 returns [] while loading as well as when the scope is
    // truly empty — only seed once annotations exist (an empty scope needs no
    // seeding: nothing to display, keep the default eye states).
    if (!annotations?.length) return;
    doneAnnotationsScopeRef.current = scopeId;

    const modeByBaseMapId = {};
    annotations.forEach((a) => {
      if (a.baseMapId)
        modeByBaseMapId[a.baseMapId] = ANNOTATIONS_DISPLAY_MODE.NORMAL;
    });
    // Main included on purpose: useExtraBaseMapIdsIn3d filters it out, and
    // the entry keeps its annotations displayed if the main changes later.
    dispatch(setAnnotationsModeByBaseMapIdIn3d(modeByBaseMapId));
  }, [scopeId, disable3D, mainBaseMap?.id, annotations, dispatch]);
}
