// Plain selectors over the dexie-synced scopeConfig slice.
//
// Default configuration of a scope (no db.scopeConfigs row yet, or field
// missing on an imported row): the org appConfig may list the modules
// disabled by default (features.scopeConfig.defaultDisabledModuleKeys —
// e.g. edx hides Zones, Maillage, Points de vue); without it only the core
// modules (Fonds de plan, Dessin) are enabled. The advanced tools below start
// disabled. The first toggle creates the row seeded from these defaults
// (useScopeConfigActions).

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

// BaseMap creation sources (keys of baseMaps/data/baseMapSourceCatalog.js)
// hidden by default from the creation section: DWG import is not shipped yet.
export const DEFAULT_DISABLED_BASE_MAP_SOURCE_KEYS = ["DWG"];

const EMPTY_OBJ = {};

export function selectSelectedScopeConfig(s) {
  const scopeId = s.scopes.selectedScopeId;
  return scopeId ? (s.scopeConfig.itemsByScopeId[scopeId] ?? null) : null;
}

// Org-level default (appConfig) > hardcoded default. Pure accessor shared
// with the non-hook code paths (createScopeConfig callers).
export function getDefaultDisabledModuleKeys(appConfig) {
  return (
    appConfig?.features?.scopeConfig?.defaultDisabledModuleKeys ??
    DEFAULT_DISABLED_MODULE_KEYS
  );
}

export function selectDefaultDisabledModuleKeys(s) {
  return getDefaultDisabledModuleKeys(s.appConfig.value);
}

export function selectDisabledModuleKeys(s) {
  return (
    selectSelectedScopeConfig(s)?.disabledModuleKeys ??
    selectDefaultDisabledModuleKeys(s)
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

// Creation sources hidden from the Fonds de plan creation section.
export function selectDisabledBaseMapSourceKeys(s) {
  return (
    selectSelectedScopeConfig(s)?.disabledBaseMapSourceKeys ??
    DEFAULT_DISABLED_BASE_MAP_SOURCE_KEYS
  );
}

// System annotation templates: the per-scope "Générique" listing with its
// Ligne / Polygone templates, provisioned on the fly by
// useFreeAnnotationTemplates. Absent field => enabled (legacy scopes); a
// configuration with initSystemAnnotationTemplates false persists it off.
export function selectSystemAnnotationTemplatesEnabled(s) {
  return selectSelectedScopeConfig(s)?.systemAnnotationTemplates ?? true;
}
