import { useSelector } from "react-redux";

import {
  selectCaptureFramingActive,
  selectEffectiveViewerKey,
} from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";
import { selectPdfEditorOpen } from "Features/pdfEditor/pdfEditorSlice";
import { selectBaseMapsGridMounted } from "Features/baseMapsGrid/baseMapsGridSlice";

// Whether the unified commands toolbar is shown (buttons AND hotkeys share
// this one visibility): the editing modules (Dessin, Zones, the
// business-objects modules, Fonds de plan — with its own layout) while they
// display a 2D map editor or the 3D editor, and nothing covers / freezes the
// editor (capture framing, walk mode, PDF editor, base maps grid, "create a
// base map" section). Never in the read-only Viewer / Maillage modules nor in
// the POV / Krto / Portfolio / Table / Admin modules.
export function selectShowCommandsToolbar(s) {
  const moduleKey = s.viewers.selectedViewerKey;
  const moduleOk =
    moduleKey === "MAP" ||
    moduleKey === "ZONES" ||
    moduleKey === "BASE_MAPS" ||
    isBusinessObjectsModuleKey(moduleKey);
  if (!moduleOk) return false;
  const effectiveKey = selectEffectiveViewerKey(s);
  if (
    effectiveKey !== "MAP" &&
    effectiveKey !== "BASE_MAPS" &&
    !isThreedFamilyViewerKey(effectiveKey)
  )
    return false;
  if (selectCaptureFramingActive(s)) return false;
  if (s.threedEditor.walkMode.active) return false;
  if (selectPdfEditorOpen(s)) return false;
  if (selectBaseMapsGridMounted(s)) return false;
  if (s.mapEditor.showCreateBaseMapSection) return false;
  return true;
}

export default function useShowCommandsToolbar() {
  return useSelector(selectShowCommandsToolbar);
}
