// Plain selectors over the dexie-synced scopeConfig slice.
//
// Default configuration of a scope (no db.scopeConfigs row yet, or field
// missing on an imported row): only the core modules (Fonds de plan, Dessin)
// are enabled, and the advanced tools below start disabled. The first toggle
// creates the row seeded from these defaults (useScopeConfigActions).

export const DEFAULT_DISABLED_MODULE_KEYS = [
  "PHOTOS",
  "POINT_OF_VIEW",
  "PORTFOLIO",
  "THREED",
  "MESHES",
  "ZONES",
  "BUSINESS_OBJECTS",
];

export const DEFAULT_DISABLED_TOOL_KEYS = [
  "ANNOTATIONS_AUTO",
  "ELEVATION",
  "IMPORT_ANNOTATIONS",
  "RESOURCES",
];

const EMPTY_OBJ = {};

export function selectSelectedScopeConfig(s) {
  const scopeId = s.scopes.selectedScopeId;
  return scopeId ? (s.scopeConfig.itemsByScopeId[scopeId] ?? null) : null;
}

export function selectDisabledModuleKeys(s) {
  return (
    selectSelectedScopeConfig(s)?.disabledModuleKeys ??
    DEFAULT_DISABLED_MODULE_KEYS
  );
}

export function selectDisabledToolKeys(s) {
  return (
    selectSelectedScopeConfig(s)?.disabledToolKeys ?? DEFAULT_DISABLED_TOOL_KEYS
  );
}

export function selectDisabledToolKeysByModule(s) {
  return selectSelectedScopeConfig(s)?.disabledToolKeysByModule ?? EMPTY_OBJ;
}

// Per-scope module label overrides ({moduleKey: label}). Empty by default —
// the module catalog falls back to its appConfig / hardcoded labels.
export function selectModuleLabelsByKey(s) {
  return selectSelectedScopeConfig(s)?.moduleLabelsByKey ?? EMPTY_OBJ;
}
