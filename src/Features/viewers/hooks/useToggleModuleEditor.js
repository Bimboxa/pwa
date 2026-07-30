import { useDispatch, useSelector } from "react-redux";

import { setModuleEditorKey } from "../viewersSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useViewers from "./useViewers";
import {
  switchMapToThreed,
  switchThreedToMap,
} from "../services/syncCamerasOnViewerSwitch";
import { selectEffectiveViewerKey } from "../utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "../utils/threedViewerKeys";

// Toggles the 2D/3D editor displayed inside the current multi-editor module
// (Dessin, Zones, Viewer), reusing the MAP <-> THREED camera sync but
// committing the module's editor key instead of the selected module: the
// left-band selection stays put. Generalizes the POV useTogglePovViewerMode
// pattern.
export default function useToggleModuleEditor() {
  const dispatch = useDispatch();

  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  const basePose = useSelector((s) => s.mapEditor.baseMapPoseInBg);
  const baseMap = useMainBaseMap();
  const viewers = useViewers();

  return function toggleModuleEditor() {
    if (effectiveViewerKey === "THREED") {
      // The module's 2D editor key: "MAP" for every multi-editor module — they
      // all display the single shared MainMapEditorV3 instance, which is the
      // one registered in mapEditorRegistry and synced by switchThreedToMap.
      const module = viewers.find((v) => v.key === moduleKey);
      const editor2dKey =
        module?.editors?.find((e) => !isThreedFamilyViewerKey(e)) ?? moduleKey;
      switchThreedToMap({
        dispatch,
        baseMap,
        basePose,
        commit: (d) =>
          d(setModuleEditorKey({ moduleKey, editorKey: editor2dKey })),
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
