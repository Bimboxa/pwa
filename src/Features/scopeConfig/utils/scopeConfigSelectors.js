// Plain selectors over the dexie-synced scopeConfig slice.
//
// Default configuration of a scope (no db.scopeConfigs row yet, or field
// missing on an imported row): the org appConfig may list the modules
// enabled by default (features.scopeConfig.defaultEnabledModuleKeys — e.g.
// edx enables Photos, Carnet de plans, Viewer besides the core modules);
// without it only the core modules (Fonds de plan, Dessin) are enabled. The
// advanced tools below start disabled. The first toggle creates the row
// seeded from these defaults (useScopeConfigActions).
//
// Configurations (Data/<org>/configurations, yaml default) express modules
// in the ENABLED form; the persisted row keeps the DISABLED form
// (disabledModuleKeys). getDisabledModuleKeysFromEnabled is the single
// conversion point.

import { BUSINESS_OBJECTS_MODULE_KEYS } from "Features/businessObjects/utils/businessObjectModuleKeys";

// Modules of the left band that a scope may enable or disable: the
// useViewers.jsx catalog minus the locked core modules (BASE_MAPS, MAP) and
// the hard-disabled entries. Keep in sync when a module is added; the
// business-objects modules (one per registered type) come from the registry.
export const CONFIGURABLE_MODULE_KEYS = [
  "PHOTOS",
  "POINT_OF_VIEW",
  "PORTFOLIO",
  "THREED",
  "MESHES",
  "ZONES",
  ...BUSINESS_OBJECTS_MODULE_KEYS,
];

// Hardcoded default: only the core modules stay enabled.
export const DEFAULT_DISABLED_MODULE_KEYS = [...CONFIGURABLE_MODULE_KEYS];

// The persisted disabledModuleKeys is the DISABLED form, so a module added
// to the catalog after a row was written is absent from it — and would read
// as enabled. Rows therefore stamp the configurable keys they know
// (knownModuleKeys, rewritten on every write); a module the row does not
// know follows the org default like a scope without a row. Rows written
// before the stamp existed knew exactly this set.
export const LEGACY_KNOWN_MODULE_KEYS = [
  "PHOTOS",
  "POINT_OF_VIEW",
  "PORTFOLIO",
  "THREED",
  "MESHES",
  "ZONES",
  "BUSINESS_OBJECTS",
];

// Effective disabled list of a row: its disabled keys + the configurable
// keys it does not know that the org default disables. Pure, shared with the
// row writers (they materialize this list before re-stamping
// knownModuleKeys).
export function getEffectiveDisabledModuleKeys(row, defaultDisabledModuleKeys) {
  if (!row?.disabledModuleKeys) return defaultDisabledModuleKeys;
  const known = new Set(row.knownModuleKeys ?? LEGACY_KNOWN_MODULE_KEYS);
  const unknownDisabled = CONFIGURABLE_MODULE_KEYS.filter(
    (k) => !known.has(k) && defaultDisabledModuleKeys.includes(k)
  );
  if (unknownDisabled.length === 0) return row.disabledModuleKeys;
  return [
    ...row.disabledModuleKeys,
    ...unknownDisabled.filter((k) => !row.disabledModuleKeys.includes(k)),
  ];
}

// Enabled form -> persisted disabled form. Unknown or core keys in the
// enabled list are ignored (core modules can never be disabled anyway).
export function getDisabledModuleKeysFromEnabled(enabledModuleKeys) {
  const enabled = new Set(enabledModuleKeys ?? []);
  return CONFIGURABLE_MODULE_KEYS.filter((k) => !enabled.has(k));
}

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

// Org-level default (appConfig, enabled form) > hardcoded default. Returns
// the DISABLED form consumed by the row writers. Pure accessor shared with
// the non-hook code paths (createScopeConfig callers).
export function getDefaultDisabledModuleKeys(appConfig) {
  const enabled = appConfig?.features?.scopeConfig?.defaultEnabledModuleKeys;
  return enabled
    ? getDisabledModuleKeysFromEnabled(enabled)
    : DEFAULT_DISABLED_MODULE_KEYS;
}

// Memoized on the appConfig reference: `getDefaultDisabledModuleKeys`
// rebuilds an array on every call, and a selector returning a fresh
// reference re-renders every `useSelector` consumer (useViewers → the whole
// left band) on every store update.
let _defaultDisabledMemo = { appConfig: undefined, value: null };

export function selectDefaultDisabledModuleKeys(s) {
  const appConfig = s.appConfig.value;
  if (
    _defaultDisabledMemo.appConfig !== appConfig ||
    !_defaultDisabledMemo.value
  ) {
    _defaultDisabledMemo = {
      appConfig,
      value: getDefaultDisabledModuleKeys(appConfig),
    };
  }
  return _defaultDisabledMemo.value;
}

// Memoized on the (row, default) pair: the effective list may be a fresh
// array, and a selector returning a fresh reference re-renders every
// consumer (useViewers → the whole left band) on every store update.
let _disabledModuleKeysMemo = { row: undefined, def: undefined, value: null };

export function selectDisabledModuleKeys(s) {
  const row = selectSelectedScopeConfig(s);
  const def = selectDefaultDisabledModuleKeys(s);
  if (
    _disabledModuleKeysMemo.row !== row ||
    _disabledModuleKeysMemo.def !== def ||
    !_disabledModuleKeysMemo.value
  ) {
    _disabledModuleKeysMemo = {
      row,
      def,
      value: getEffectiveDisabledModuleKeys(row, def),
    };
  }
  return _disabledModuleKeysMemo.value;
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

// Per-scope module icon overrides ({moduleKey: iconKey of
// viewers/data/moduleIconsMap.js}). Empty by default — the module catalog
// falls back to the type's default icon.
export function selectModuleIconKeysByKey(s) {
  return selectSelectedScopeConfig(s)?.moduleIconKeysByKey ?? EMPTY_OBJ;
}

// Per-scope order of the left-band modules (full list of module keys, locked
// and disabled ones included). null => catalog order. Applied by useViewers
// through sortModulesByOrder; the row's own array keeps the reference stable.
export function selectModuleOrder(s) {
  return selectSelectedScopeConfig(s)?.moduleOrder ?? null;
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
