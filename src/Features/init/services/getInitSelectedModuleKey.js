import getDisable3DFromLocalStorage from "Features/appConfig/services/getDisable3DFromLocalStorage";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// Module keys restorable on page load — kept in sync with useViewers.jsx.
// LISTING is excluded on purpose: it requires advancedLayout, which is never
// persisted, so the module would be absent from the band after a reload.
const RESTORABLE_MODULE_KEYS = [
  "MAP",
  "BASE_MAPS",
  "THREED",
  "POINT_OF_VIEW",
  "PORTFOLIO",
  "MESHES",
  "ZONES",
];

export default function getInitSelectedModuleKey() {
  const moduleKey = localStorage.getItem("initSelectedModuleKey");

  if (!RESTORABLE_MODULE_KEYS.includes(moduleKey)) return null;

  // Don't restore a 3D-family module when 3D is disabled: the store would
  // mount the 3D editor for one frame before the landing effect corrects it.
  if (isThreedFamilyViewerKey(moduleKey) && getDisable3DFromLocalStorage())
    return null;

  return moduleKey;
}
