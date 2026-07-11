import { useDispatch, useSelector } from "react-redux";

import { setSelectedViewerKey } from "../viewersSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import {
  switchMapToThreed,
  switchThreedToMap,
} from "../services/syncCamerasOnViewerSwitch";

// Central entry point for viewer changes. Intercepts the MAP <-> THREED
// transitions to keep the baseMap image at the same on-screen place/size
// (camera sync + 3D top-down animation); any other transition is a plain
// `setSelectedViewerKey` dispatch.
export default function useSwitchViewer() {
  const dispatch = useDispatch();

  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const basePose = useSelector((s) => s.mapEditor.baseMapPoseInBg);
  const baseMap = useMainBaseMap();

  return function switchViewer(viewerKey) {
    if (viewerKey === selectedViewerKey) return;

    if (selectedViewerKey === "MAP" && viewerKey === "THREED") {
      switchMapToThreed({ dispatch, baseMap, basePose });
    } else if (selectedViewerKey === "THREED" && viewerKey === "MAP") {
      switchThreedToMap({ dispatch, baseMap, basePose });
    } else {
      dispatch(setSelectedViewerKey(viewerKey));
    }
  };
}
