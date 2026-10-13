import { useDispatch, useSelector } from "react-redux";

import {
  setHideBaseMapImageInViewer,
  setHideAnnotationsInViewer,
  setVisibleBaseMapIdsIn2d,
  setAnnotationsBaseMapIdsIn2d,
} from "Features/viewers/viewersSlice";
import {
  setVisibleBaseMapIdsIn3d,
  setAnnotationsModeByBaseMapIdIn3d,
  setHideMainBaseMapImageIn3d,
  setHideMainBaseMapAnnotationsIn3d,
} from "Features/threedEditor/threedEditorSlice";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// ---------------------------------------------------------------------------
// useHideOtherBaseMaps — "Visibilité auto" of the base maps list: after a
// base map is selected as main, show it fully and hide the image and the
// annotations of every OTHER base map, in the editor actually displayed:
// - 2D: the overlays (viewers.visibleBaseMapIdsIn2d /
//   annotationsBaseMapIdsIn2d) are emptied, the main flags reset;
// - 3D: the 3D eyes (threedEditor.visibleBaseMapIdsIn3d) and the
//   annotations modes of the other base maps are cleared, the hideMain*
//   flags reset.
// Dispatched after useSelectMainBaseMap (synchronous): in the Viewer module
// that hook transfers the previous main's eye states, which are overridden
// here on purpose.
// ---------------------------------------------------------------------------

export default function useHideOtherBaseMaps() {
  const dispatch = useDispatch();

  // data

  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const isThreedDisplayed = isThreedFamilyViewerKey(effectiveViewerKey);

  // handler

  return function hideOtherBaseMaps() {
    if (isThreedDisplayed) {
      dispatch(setVisibleBaseMapIdsIn3d([]));
      dispatch(setAnnotationsModeByBaseMapIdIn3d({}));
      dispatch(setHideMainBaseMapImageIn3d(false));
      dispatch(setHideMainBaseMapAnnotationsIn3d(false));
      return;
    }
    dispatch(setVisibleBaseMapIdsIn2d([]));
    dispatch(setAnnotationsBaseMapIdsIn2d([]));
    dispatch(setHideBaseMapImageInViewer(false));
    dispatch(setHideAnnotationsInViewer(false));
  };
}
