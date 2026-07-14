import { useDispatch, useSelector } from "react-redux";

import { setSelectedViewerKey } from "../viewersSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import {
  switchMapToThreed,
  switchThreedToMap,
} from "../services/syncCamerasOnViewerSwitch";
import { isThreedFamilyViewerKey } from "../utils/threedViewerKeys";

// Central entry point for viewer changes. Intercepts the MAP <-> 3D-family
// (THREED / MESHES) transitions to keep the baseMap image at the same
// on-screen place/size (camera sync + 3D top-down animation); any other
// transition — including THREED <-> MESHES, which share the same 3D editor —
// is a plain `setSelectedViewerKey` dispatch.
export default function useSwitchViewer() {
  const dispatch = useDispatch();

  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const basePose = useSelector((s) => s.mapEditor.baseMapPoseInBg);
  const baseMap = useMainBaseMap();

  return function switchViewer(viewerKey) {
    if (viewerKey === selectedViewerKey) return;

    const fromThreed = isThreedFamilyViewerKey(selectedViewerKey);
    const toThreed = isThreedFamilyViewerKey(viewerKey);

    if (selectedViewerKey === "MAP" && toThreed) {
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
