import { useDispatch, useSelector } from "react-redux";

import { setSelectedViewerKey, setModuleEditorKey } from "../viewersSlice";
import { setPovViewerMode } from "Features/pov/povSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useViewers from "./useViewers";

import {
  switchMapToThreed,
  switchThreedToMap,
} from "../services/syncCamerasOnViewerSwitch";
import { isThreedFamilyViewerKey } from "../utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "../utils/effectiveViewerKey";

// Central entry point for MODULE changes (the left-band selection). A module
// switch never changes the displayed editor family when the target module
// supports it (multi-editor modules inherit the current editor); when the
// displayed editor does change family, the MAP <-> 3D camera sync keeps the
// baseMap image at the same on-screen place/size. Editor toggles WITHIN a
// module go through useToggleModuleEditor instead.
export default function useSwitchViewer() {
  const dispatch = useDispatch();

  const viewers = useViewers();
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  // The editor actually displayed (multi-editor modules resolve to it).
  const effectiveFromKey = useSelector(selectEffectiveViewerKey);
  const editorKeyByModule = useSelector((s) => s.viewers.editorKeyByModule);
  const povViewerMode = useSelector((s) => s.pov.viewerMode);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  const basePose = useSelector((s) => s.mapEditor.baseMapPoseInBg);
  const baseMap = useMainBaseMap();

  return function switchViewer(viewerKey) {
    if (viewerKey === selectedViewerKey) return;

    const targetModule = viewers.find((v) => v.key === viewerKey);
    const editors = targetModule?.editors ?? [viewerKey];

    // Resolve the editor the target module will display.
    let targetEditorKey;
    if (editors.length === 1) {
      targetEditorKey = editors[0];
    } else if (
      isThreedFamilyViewerKey(effectiveFromKey) &&
      editors.includes("THREED")
    ) {
      // Inherit the currently displayed editor family (no camera jump).
      targetEditorKey = "THREED";
    } else if (effectiveFromKey === "MAP" && editors.includes("MAP")) {
      targetEditorKey = "MAP";
    } else {
      // From an unrelated editor (BASE_MAPS, PORTFOLIO...): keep the target
      // module's memory. POV keeps its own editor mode until it migrates to
      // editorKeyByModule (see issue #296).
      targetEditorKey =
        viewerKey === "POINT_OF_VIEW"
          ? povViewerMode
          : (editorKeyByModule?.[viewerKey] ?? editors[0]);
    }
    if (disable3D && targetEditorKey === "THREED" && editors.includes("MAP"))
      targetEditorKey = "MAP";

    const commit = (d) => {
      if (editors.length > 1) {
        if (viewerKey === "POINT_OF_VIEW") {
          d(setPovViewerMode(targetEditorKey === "THREED" ? "THREED" : "MAP"));
        } else {
          d(setModuleEditorKey({ moduleKey: viewerKey, editorKey: targetEditorKey }));
        }
      }
      d(setSelectedViewerKey(viewerKey));
    };

    const fromThreed = isThreedFamilyViewerKey(effectiveFromKey);
    const toThreed = isThreedFamilyViewerKey(targetEditorKey);

    if (effectiveFromKey === "MAP" && toThreed) {
      switchMapToThreed({ dispatch, baseMap, basePose, commit });
    } else if (fromThreed && targetEditorKey === "MAP") {
      switchThreedToMap({ dispatch, baseMap, basePose, commit });
    } else {
      commit(dispatch);
    }
  };
}
