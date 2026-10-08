import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setHideBaseMapImageInViewer,
  setLandOnDrawScopeId,
  setViewerReturnContext,
} from "../viewersSlice";
import {
  setAnnotationsModeByBaseMapIdIn3d,
  setHideMainBaseMapImageIn3d,
  setRevealOnMainSelectSuspended,
} from "Features/threedEditor/threedEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useDisabledBaseMapIds from "Features/baseMaps/hooks/useDisabledBaseMapIds";
import { selectHasSavedThreedVisibility } from "Features/scopeVisibility/selectors/scopeVisibilitySelectors";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import { ANNOTATIONS_DISPLAY_MODE } from "Features/threedEditor/constants/annotationsDisplayModeIn3d";

// Scope-open seeding of the Viewer module's 3D visibility: baseMap images
// hidden (main's image eye off — non-main are already off by default) and
// annotations of EVERY annotated baseMap displayed. Runs once per scope open
// (re-armed when the scope closes back to the dashboard). Mounted in
// LayoutDesktop next to the landing effect.
// Skipped entirely when the scope has saved 3D toggles on this device
// (scopeVisibility, localStorage): the restored state is the user's own
// choice and must not be overwritten by the defaults.
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
  const landOnDrawScopeId = useSelector((s) => s.viewers.landOnDrawScopeId);
  const hasSavedThreedState = useSelector(selectHasSavedThreedVisibility);
  const hideMainImage = useSelector(
    (s) => s.threedEditor.hideMainBaseMapImageIn3d
  );
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );
  const mainBaseMap = useMainBaseMap();
  // Base maps of the folders disabled for the scope: their annotations are
  // not seeded (a disabled folder's base map must stay out of the 3D scene).
  const { disabledIds: disabledBaseMapIds, synced: disabledSynced } =
    useDisabledBaseMapIds();
  // Same option set as useAnnotationsCountByBaseMapId (the base maps list
  // badges):
  // every baseMap of the project is counted, not just the visible ones.
  const annotations = useAnnotationsV2({
    caller: "useInitViewerModuleOnScopeOpen",
    filterBySelectedScope: true,
    excludeListingsIds: hiddenListingsIds,
    excludeProfileTemplates: true,
    hideBaseMapAnnotations: true,
    excludeIsForBaseMapsListings: true,
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

  // The "land on Dessin" flag of a freshly created scope only lives while
  // that scope stays selected — reopening it later lands on the Viewer.
  useEffect(() => {
    if (landOnDrawScopeId && scopeId !== landOnDrawScopeId) {
      dispatch(setLandOnDrawScopeId(null));
    }
  }, [scopeId, landOnDrawScopeId, dispatch]);

  // The return context ("Retour" button + listing narrowing of the drawing
  // panels) only makes sense within the scope it was written in: a stale
  // listingId from another scope would empty PopperMapListings / PanelDrawing
  // of the scope opened (or created) next.
  const viewerReturnContext = useSelector((s) => s.viewers.viewerReturnContext);
  const viewerReturnContextRef = useRef(viewerReturnContext);
  viewerReturnContextRef.current = viewerReturnContext;
  useEffect(() => {
    if (viewerReturnContextRef.current) dispatch(setViewerReturnContext(null));
  }, [scopeId, dispatch]);

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
    if (landingActive && !hideMainImage && !hasSavedThreedState) {
      dispatch(setHideMainBaseMapImageIn3d(true));
    }
  }, [landingActive, hideMainImage, hasSavedThreedState, dispatch]);

  // Images off — dispatched as soon as the scope + main baseMap are known,
  // WITHOUT waiting for the annotations: the hide must be in redux before the
  // 3D textures land, otherwise the baseMaps flash visible then hide one by
  // one (the visibility pass + ImagesManager then keep every group hidden in
  // batch, including the ones created later).
  useEffect(() => {
    // Viewer module only: a freshly created scope lands on Dessin and must
    // NOT get its 3D image hidden — the seeding then runs at the first
    // Viewer visit (isViewerModule is a dependency).
    if (disable3D || !isViewerModule) return;
    if (!scopeId || doneImagesScopeRef.current === scopeId) return;
    // Wait for the main baseMap selection to settle: setSelectedMainBaseMapId
    // resets hideMainBaseMapImageIn3d (threedEditorSlice extraReducer) and
    // must not clobber the flag set below.
    if (!mainBaseMap?.id) return;
    doneImagesScopeRef.current = scopeId;
    // Saved toggles restored for this scope: keep them.
    if (hasSavedThreedState) return;

    dispatch(setHideBaseMapImageInViewer(false));
    dispatch(setHideMainBaseMapImageIn3d(true));
  }, [
    scopeId,
    disable3D,
    isViewerModule,
    mainBaseMap?.id,
    hasSavedThreedState,
    dispatch,
  ]);

  // Annotations of every annotated baseMap displayed — once the annotations
  // are loaded.
  useEffect(() => {
    if (disable3D || !isViewerModule || !scopeId) return;
    if (doneAnnotationsScopeRef.current === scopeId) return;
    if (!mainBaseMap?.id) return;
    // useAnnotationsV2 returns [] while loading as well as when the scope is
    // truly empty — only seed once annotations exist (an empty scope needs no
    // seeding: nothing to display, keep the default eye states).
    if (!annotations?.length) return;
    // Wait for the scope's disabled folders (EMPTY while the scope record
    // loads: seeding then would include the disabled base maps).
    if (!disabledSynced) return;
    doneAnnotationsScopeRef.current = scopeId;
    // Saved toggles restored for this scope: keep them.
    if (hasSavedThreedState) return;

    const modeByBaseMapId = {};
    annotations.forEach((a) => {
      if (a.baseMapId && !disabledBaseMapIds.has(a.baseMapId))
        modeByBaseMapId[a.baseMapId] = ANNOTATIONS_DISPLAY_MODE.NORMAL;
    });
    // Main included on purpose: useExtraBaseMapIdsIn3d filters it out, and
    // the entry keeps its annotations displayed if the main changes later.
    dispatch(setAnnotationsModeByBaseMapIdIn3d(modeByBaseMapId));
  }, [
    scopeId,
    disable3D,
    isViewerModule,
    mainBaseMap?.id,
    annotations,
    hasSavedThreedState,
    disabledBaseMapIds,
    disabledSynced,
    dispatch,
  ]);
}
