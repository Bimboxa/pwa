import { useDispatch, useSelector } from "react-redux";

import {
  setHideBaseMapImageInViewer,
  setHideAnnotationsInViewer,
  setBaseMapsImageMode,
} from "Features/viewers/viewersSlice";
import {
  toggleMainBaseMapImageIn3d,
  toggleMainBaseMapAnnotationsIn3d,
} from "Features/threedEditor/threedEditorSlice";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { BASE_MAPS_IMAGE_MODE } from "Features/baseMaps/constants/baseMapsImageMode";

// Visibility state + toggles of the MAIN baseMap's image and annotations,
// resolved against the editor actually displayed:
// - 3D family editor: the `threedEditor.hideMainBaseMap*In3d` flags, read by
//   useApplyBaseMapVisibilityIn3d / ThreedAnnotationsVisibility;
// - 2D editor: the `viewers.hide*InViewer` flags, read by MainMapEditorV3.
// Shared by the top-bar selector (BaseMapSelectorInMapEditorV2) and the
// base maps list (SectionBaseMapsList) so both controls drive the same state.
// The global image mode NONE (viewers.baseMapsImageMode) hides every base map
// image over these flags: the image eye then reads off, and a click on it
// brings the mode back to FULL (and the flag on) so the eye always does what
// it shows.
// Callers keep their own `e.stopPropagation()`.
export default function useMainBaseMapVisibilityToggles() {
  const dispatch = useDispatch();

  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const isThreedDisplayed = isThreedFamilyViewerKey(effectiveViewerKey);

  const hideImageInViewer = useSelector(
    (s) => s.viewers.hideBaseMapImageInViewer
  );
  const hideAnnotationsInViewer = useSelector(
    (s) => s.viewers.hideAnnotationsInViewer
  );
  const hideMainImageIn3d = useSelector(
    (s) => s.threedEditor.hideMainBaseMapImageIn3d
  );
  const hideMainAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideMainBaseMapAnnotationsIn3d
  );

  const imagesHiddenByMode = useSelector(
    (s) => s.viewers.baseMapsImageMode === BASE_MAPS_IMAGE_MODE.NONE
  );

  const eyeOn = isThreedDisplayed ? !hideMainImageIn3d : !hideImageInViewer;
  const imageOn = eyeOn && !imagesHiddenByMode;
  const annotationsOn = isThreedDisplayed
    ? !hideMainAnnotationsIn3d
    : !hideAnnotationsInViewer;

  function toggleImage() {
    if (imagesHiddenByMode) {
      dispatch(setBaseMapsImageMode(BASE_MAPS_IMAGE_MODE.FULL));
      // already on under the mode: nothing else to flip
      if (eyeOn) return;
    }
    if (isThreedDisplayed) dispatch(toggleMainBaseMapImageIn3d());
    else dispatch(setHideBaseMapImageInViewer(eyeOn));
  }

  function toggleAnnotations() {
    if (isThreedDisplayed) dispatch(toggleMainBaseMapAnnotationsIn3d());
    else dispatch(setHideAnnotationsInViewer(annotationsOn));
  }

  return {
    isThreedDisplayed,
    imageOn,
    annotationsOn,
    toggleImage,
    toggleAnnotations,
  };
}
