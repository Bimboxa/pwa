import { useDispatch, useSelector } from "react-redux";

import {
  setHideBaseMapImageInViewer,
  setHideAnnotationsInViewer,
} from "Features/viewers/viewersSlice";
import {
  toggleMainBaseMapImageIn3d,
  toggleMainBaseMapAnnotationsIn3d,
} from "Features/threedEditor/threedEditorSlice";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// Visibility state + toggles of the MAIN baseMap's image and annotations,
// resolved against the editor actually displayed:
// - 3D family editor: the `threedEditor.hideMainBaseMap*In3d` flags, read by
//   useApplyBaseMapVisibilityIn3d / ThreedAnnotationsVisibility;
// - 2D editor: the `viewers.hide*InViewer` flags, read by MainMapEditorV3.
// Shared by the top-bar selector (BaseMapSelectorInMapEditorV2) and the
// chips band (TopBaseMapChipsThreed) so both controls drive the same state.
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

  const imageOn = isThreedDisplayed ? !hideMainImageIn3d : !hideImageInViewer;
  const annotationsOn = isThreedDisplayed
    ? !hideMainAnnotationsIn3d
    : !hideAnnotationsInViewer;

  function toggleImage() {
    if (isThreedDisplayed) dispatch(toggleMainBaseMapImageIn3d());
    else dispatch(setHideBaseMapImageInViewer(imageOn));
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
