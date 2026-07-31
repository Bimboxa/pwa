import { useCallback } from "react";
import { useDispatch, useStore } from "react-redux";

import {
  setBaseMapAnnotationsModeIn3d,
  setVisibleBaseMapIdsIn3d,
  setHideMainBaseMapImageIn3d,
  setHideMainBaseMapAnnotationsIn3d,
} from "Features/threedEditor/threedEditorSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import { ANNOTATIONS_DISPLAY_MODE } from "Features/threedEditor/constants/annotationsDisplayModeIn3d";

// Promote a basemap to "main" (mapEditor.selectedBaseMapId) — shared by the top
// chips band (TopBaseMapChipsThreed) and the 3D scene's double-click on a plan.
//
// The state is read from the store at call time rather than through selectors:
// the scene handler is a useCallback with stable deps, so a captured snapshot
// would go stale between renders.
export default function useSelectMainBaseMap() {
  const dispatch = useDispatch();
  const store = useStore();

  return useCallback(
    (baseMapId) => {
      if (!baseMapId) return;

      const state = store.getState();
      const prevMainId = state.mapEditor.selectedBaseMapId;
      if (baseMapId === prevMainId) return;

      const isViewerModule = state.viewers.selectedViewerKey === "THREED";
      if (!isViewerModule) {
        dispatch(setSelectedMainBaseMapId(baseMapId));
        return;
      }

      // Viewer module: the slice's "reveal fully" extraReducer resets the
      // hideMain* flags on setSelectedMainBaseMapId — selecting a basemap must
      // not re-show a hidden image, so transfer the eye states across the main
      // swap (dispatches are synchronous, the re-force wins).
      const visibleIds = state.threedEditor.visibleBaseMapIdsIn3d ?? [];
      const annotationsModeByBaseMapId =
        state.threedEditor.annotationsModeByBaseMapIdIn3d;
      const prevImageOn = !state.threedEditor.hideMainBaseMapImageIn3d;
      const prevAnnotationsOn =
        !state.threedEditor.hideMainBaseMapAnnotationsIn3d;
      const nextImageOn = visibleIds.includes(baseMapId);
      const nextAnnotationsOn =
        (annotationsModeByBaseMapId?.[baseMapId] ??
          ANNOTATIONS_DISPLAY_MODE.NONE) !== ANNOTATIONS_DISPLAY_MODE.NONE;

      dispatch(setSelectedMainBaseMapId(baseMapId));
      dispatch(setHideMainBaseMapImageIn3d(!nextImageOn));
      dispatch(setHideMainBaseMapAnnotationsIn3d(!nextAnnotationsOn));
      if (prevMainId) {
        const nextVisibleIds = new Set(visibleIds);
        if (prevImageOn) nextVisibleIds.add(prevMainId);
        else nextVisibleIds.delete(prevMainId);
        nextVisibleIds.delete(baseMapId); // new main is driven by the hideMain flags
        dispatch(setVisibleBaseMapIdsIn3d([...nextVisibleIds]));
        dispatch(
          setBaseMapAnnotationsModeIn3d({
            baseMapId: prevMainId,
            mode: prevAnnotationsOn
              ? ANNOTATIONS_DISPLAY_MODE.NORMAL
              : ANNOTATIONS_DISPLAY_MODE.NONE,
          })
        );
      }
    },
    [dispatch, store]
  );
}
