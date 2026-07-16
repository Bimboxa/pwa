import { useDispatch, useSelector } from "react-redux";

import { setPovViewerMode } from "../povSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import {
  switchMapToThreed,
  switchThreedToMap,
} from "Features/viewers/services/syncCamerasOnViewerSwitch";

// Toggles the 2D/3D editor displayed inside the POINT_OF_VIEW viewer, reusing
// the MAP <-> THREED camera sync but committing pov.viewerMode instead of the
// selected viewer key (the viewer stays POINT_OF_VIEW).
export default function useTogglePovViewerMode() {
  const dispatch = useDispatch();

  const viewerMode = useSelector((s) => s.pov.viewerMode);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  const basePose = useSelector((s) => s.mapEditor.baseMapPoseInBg);
  const baseMap = useMainBaseMap();

  return function togglePovViewerMode() {
    if (viewerMode === "THREED") {
      switchThreedToMap({
        dispatch,
        baseMap,
        basePose,
        commit: (d) => d(setPovViewerMode("MAP")),
      });
    } else {
      if (disable3D) return;
      switchMapToThreed({
        dispatch,
        baseMap,
        basePose,
        commit: (d) => d(setPovViewerMode("THREED")),
      });
    }
  };
}
