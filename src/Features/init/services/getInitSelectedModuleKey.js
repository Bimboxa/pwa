import getDisable3DFromLocalStorage from "Features/appConfig/services/getDisable3DFromLocalStorage";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { BUSINESS_OBJECTS_MODULE_KEYS } from "Features/businessObjects/utils/businessObjectModuleKeys";

// Module keys restorable on page load — kept in sync with useViewers.jsx
// (the business-objects modules come from the types registry: a persisted
// key of a type that no longer exists is not restored). A restored module
// disabled on the current scope is handled by useEnsureEnabledModule.
const RESTORABLE_MODULE_KEYS = [
  "MAP",
  "BASE_MAPS",
  "THREED",
  "POINT_OF_VIEW",
  "PORTFOLIO",
  "MESHES",
  "ZONES",
  "PHOTOS",
  "SCOPE",
  ...BUSINESS_OBJECTS_MODULE_KEYS,
];

export default function getInitSelectedModuleKey() {
  const moduleKey = localStorage.getItem("initSelectedModuleKey");

  // The "Liste d'objets" module became the SCOPE module: restore the users
  // who left the app on it instead of dropping them on the default module.
  if (moduleKey === "LISTING") return "SCOPE";

  if (!RESTORABLE_MODULE_KEYS.includes(moduleKey)) return null;

  // Don't restore a 3D-family module when 3D is disabled: the store would
  // mount the 3D editor for one frame before the landing effect corrects it.
  if (isThreedFamilyViewerKey(moduleKey) && getDisable3DFromLocalStorage())
    return null;

  return moduleKey;
}
