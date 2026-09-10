// Label of the SCOPE module (the left-band entry naming the scope itself).
// Priority: per-scope override (scopeConfigs.moduleLabelsByKey.SCOPE) > org
// appConfig strings.scope.nameSingular — the string that already names a scope
// everywhere else in the app ("Krto", "Mission"...) — > the generic default.
export const SCOPE_MODULE_KEY = "SCOPE";

export const DEFAULT_SCOPE_MODULE_LABEL = "Dossier";

export default function resolveScopeModuleLabel({
  moduleLabelsByKey,
  appConfigScopeName,
} = {}) {
  const override = moduleLabelsByKey?.[SCOPE_MODULE_KEY];
  if (override?.trim()) return override.trim();
  if (appConfigScopeName?.trim()) return appConfigScopeName.trim();
  return DEFAULT_SCOPE_MODULE_LABEL;
}
