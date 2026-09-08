// Code registry of the business object TYPES. Each type is a family of
// business-object listings sharing the same behavior (left drawer panel,
// tools, default label / icon) and gets its own module in the left band:
// key "BUSINESS_OBJECTS" for STANDARD, "BUSINESS_OBJECTS_<TYPE>" otherwise
// (see utils/businessObjectModuleKeys.js). Per scope, db.scopeConfigs can
// override the module label (moduleLabelsByKey), icon (moduleIconKeysByKey),
// activation (disabledModuleKeys) and position (moduleOrder).
//
// Pure data: imported by the scopeConfig selectors and the init services
// (themselves imported by viewersSlice), so it must stay free of JSX / hooks.
// Adding a type = one entry here + one panel line in
// components/PanelBusinessObjectsByType.jsx.

export const DEFAULT_BUSINESS_OBJECT_TYPE_KEY = "STANDARD";

const BUSINESS_OBJECT_TYPES = [
  {
    key: "STANDARD",
    defaultLabel: "Ouvrages",
    // Key of viewers/data/moduleIconsMap.js.
    defaultIconKey: "foundation",
    // Ctrl+O — only the STANDARD type carries a module hotkey (the letter
    // namespace is global, see useViewerSwitchHotkeys).
    hotkey: "O",
    // 2D editor = the shared "MAP" instance (like Zones) so entering the
    // module keeps the camera framing; 3D editor = the shared 3D one.
    editors: ["MAP", "THREED"],
  },
  {
    // Category trees (nomenclatures): same tree panel as STANDARD, no
    // module hotkey. Module key BUSINESS_OBJECTS_NOMENCLATURE — unknown to
    // the scopeConfigs rows written before it existed, so it follows the
    // org default (disabled unless listed in defaultEnabledModuleKeys) until
    // the scope enables it (see scopeConfigSelectors knownModuleKeys).
    key: "NOMENCLATURE",
    defaultLabel: "Nomenclatures",
    defaultIconKey: "category",
    editors: ["MAP", "THREED"],
  },
];

export default BUSINESS_OBJECT_TYPES;

export function getBusinessObjectType(typeKey) {
  return BUSINESS_OBJECT_TYPES.find((t) => t.key === typeKey) ?? null;
}
