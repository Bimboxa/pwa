import { useDispatch, useSelector } from "react-redux";

import { setModuleEditorKey } from "../viewersSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import {
  switchMapToThreed,
  switchThreedToMap,
} from "../services/syncCamerasOnViewerSwitch";
import { selectEffectiveViewerKey } from "../utils/effectiveViewerKey";

// Toggles the 2D/3D editor displayed inside the current multi-editor module
// (Dessin), reusing the MAP <-> THREED camera sync but committing the
// module's editor key instead of the selected module: the left-band
// selection stays put. Generalizes the POV useTogglePovViewerMode pattern.
export default function useToggleModuleEditor() {
  const dispatch = useDispatch();

  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  const basePose = useSelector((s) => s.mapEditor.baseMapPoseInBg);
  const baseMap = useMainBaseMap();

  return function toggleModuleEditor() {
    if (effectiveViewerKey === "THREED") {
      switchThreedToMap({
        dispatch,
        baseMap,
        basePose,
        commit: (d) => d(setModuleEditorKey({ moduleKey, editorKey: "MAP" })),
      });
    } else {
      if (disable3D) return;
      switchMapToThreed({
        dispatch,
        baseMap,
        basePose,
        commit: (d) =>
          d(setModuleEditorKey({ moduleKey, editorKey: "THREED" })),
      });
    }
  };
}
