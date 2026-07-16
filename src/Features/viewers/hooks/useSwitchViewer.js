import { useDispatch, useSelector } from "react-redux";

import { setSelectedViewerKey } from "../viewersSlice";
import { setPovViewerMode } from "Features/pov/povSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import {
  switchMapToThreed,
  switchThreedToMap,
} from "../services/syncCamerasOnViewerSwitch";
import { isThreedFamilyViewerKey } from "../utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "../utils/effectiveViewerKey";

// Central entry point for viewer changes. Intercepts the MAP <-> 3D-family
// (THREED / MESHES) transitions to keep the baseMap image at the same
// on-screen place/size (camera sync + 3D top-down animation); any other
// transition — including THREED <-> MESHES, which share the same 3D editor —
// is a plain `setSelectedViewerKey` dispatch.
export default function useSwitchViewer() {
  const dispatch = useDispatch();

  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  // POV resolves to the editor it displays (MAP or THREED).
  const effectiveFromKey = useSelector(selectEffectiveViewerKey);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  const basePose = useSelector((s) => s.mapEditor.baseMapPoseInBg);
  const baseMap = useMainBaseMap();

  return function switchViewer(viewerKey) {
    if (viewerKey === selectedViewerKey) return;

    // Entering POV: inherit the 2D/3D mode from the current viewer (MAP -> 2D,
    // 3D family -> 3D, anything else keeps the previous mode). The displayed
    // editor stays the same, so no camera sync is needed.
    if (viewerKey === "POINT_OF_VIEW") {
      let inherited = null;
      if (selectedViewerKey === "MAP") inherited = "MAP";
      if (isThreedFamilyViewerKey(selectedViewerKey)) inherited = "THREED";
      if (disable3D) inherited = "MAP";
      if (inherited) dispatch(setPovViewerMode(inherited));
      dispatch(setSelectedViewerKey("POINT_OF_VIEW"));
      return;
    }

    // Leaving POV: the camera sync must run against the editor POV was
    // actually displaying (effectiveFromKey), not the "POINT_OF_VIEW" key.
    const fromThreed = isThreedFamilyViewerKey(effectiveFromKey);
    const toThreed = isThreedFamilyViewerKey(viewerKey);

    if (effectiveFromKey === "MAP" && toThreed) {
      switchMapToThreed({
        dispatch,
        baseMap,
        basePose,
        targetViewerKey: viewerKey,
      });
    } else if (fromThreed && viewerKey === "MAP") {
      switchThreedToMap({ dispatch, baseMap, basePose });
    } else {
      dispatch(setSelectedViewerKey(viewerKey));
    }
  };
}
