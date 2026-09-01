// Plain selectors over the dexie-synced scopeConfig slice. Stable EMPTY
// fallbacks so consumers can use the results in memo/effect deps.

const EMPTY_ARR = [];
const EMPTY_OBJ = {};

export function selectSelectedScopeConfig(s) {
  const scopeId = s.scopes.selectedScopeId;
  return scopeId ? (s.scopeConfig.itemsByScopeId[scopeId] ?? null) : null;
}

export function selectDisabledModuleKeys(s) {
  return selectSelectedScopeConfig(s)?.disabledModuleKeys ?? EMPTY_ARR;
}

export function selectDisabledToolKeys(s) {
  return selectSelectedScopeConfig(s)?.disabledToolKeys ?? EMPTY_ARR;
}

export function selectDisabledToolKeysByModule(s) {
  return selectSelectedScopeConfig(s)?.disabledToolKeysByModule ?? EMPTY_OBJ;
}
