import { setModuleEditorKey } from "Features/viewers/viewersSlice";
import {
  setAxesPlacementModeActive,
  setMoveBaseMapModeActive,
  setRotateBaseMapModeActive,
} from "Features/threedEditor/threedEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

import { startSectionBaseMapPlacement } from "../sectionBaseMapPlacementSlice";
import { isBaseMapLinkSource } from "./baseMapLinkPredicates";

// Modules where the « + fond de plan » command of a section mark exists.
export const SECTION_BASE_MAP_MODULE_KEYS = ["BASE_MAPS", "MAP"];

const NO_3D_S = "La 3D est désactivée : le fond de plan ne peut pas être placé";

// Arms the « + fond de plan » placement for a SOURCE section mark (toolbar
// command and edit toolbar button). The placement lives in the 3D editor:
// launched from the 2D one, the module is first switched to 3D.
export default function startSectionBaseMapPlacementTool({
  dispatch,
  getState,
  annotation,
}) {
  if (!isBaseMapLinkSource(annotation)) return false;
  const state = getState();
  const moduleKey = state.viewers.selectedViewerKey;
  if (!SECTION_BASE_MAP_MODULE_KEYS.includes(moduleKey)) return false;

  if (!isThreedFamilyViewerKey(selectEffectiveViewerKey(state))) {
    if (state.appConfig?.disable3D) {
      dispatch(setToaster({ message: NO_3D_S, severity: "warning" }));
      return false;
    }
    dispatch(setModuleEditorKey({ moduleKey, editorKey: "THREED" }));
  }

  // The base map tools of the 3D editor own the pointer too.
  const threed = getState().threedEditor;
  if (threed.moveBaseMapMode?.active) dispatch(setMoveBaseMapModeActive(false));
  if (threed.rotateBaseMapMode?.active)
    dispatch(setRotateBaseMapModeActive(false));
  if (threed.axesPlacementMode?.active)
    dispatch(setAxesPlacementModeActive(false));

  const label = String(annotation.label ?? "").trim();
  dispatch(
    startSectionBaseMapPlacement({
      sourceAnnotationId: annotation.id,
      name: label ? `Coupe ${label}` : "Coupe",
    })
  );
  return true;
}
