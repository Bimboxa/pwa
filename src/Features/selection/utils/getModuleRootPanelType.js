import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";

// Panel type shown by PanelSelectionProperties at the ROOT of the selection
// (nothing selected): each module has its own default properties panel.
// The POINT_OF_VIEW module is resolved upstream (POV / POV_FRAME).
export default function getModuleRootPanelType(moduleKey) {
  if (moduleKey === "SCOPE") return "SCOPE";
  if (moduleKey === "MAP") return "DRAWING_MODULE";
  if (moduleKey === "BASE_MAPS") return "BASE_MAPS_MODULE";
  if (moduleKey === "PORTFOLIO") return "PORTFOLIO_HEADER";
  // Module's active listing (also the frame before
  // useDefaultSelectionInBusinessObjectsModule poses the LISTING selection).
  if (isBusinessObjectsModuleKey(moduleKey)) return "BUSINESS_OBJECT_LISTING";
  // Viewer, Photos, Zones, Maillage: generic module panel.
  return "MODULE_DEFAULT";
}
