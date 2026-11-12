import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";

// Whether a module carries the unified commands toolbar: the editing modules
// (Dessin, Zones, the business-objects modules, Fonds de plan, Maillage and
// Commentaires — the last three with their own layouts). Never the read-only Viewer module nor
// the POV / Krto / Portfolio / Table / Admin modules.
export default function isCommandsToolbarModuleKey(moduleKey) {
  return (
    moduleKey === "MAP" ||
    moduleKey === "ZONES" ||
    moduleKey === "BASE_MAPS" ||
    moduleKey === "MESHES" ||
    moduleKey === "COMMENTS" ||
    isBusinessObjectsModuleKey(moduleKey)
  );
}
