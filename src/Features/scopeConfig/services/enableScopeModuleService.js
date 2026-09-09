import {
  getDefaultDisabledModuleKeys,
  getEffectiveDisabledModuleKeys,
} from "../utils/scopeConfigSelectors";

import upsertScopeConfigService from "./upsertScopeConfigService";

// Enables a left-band module for a scope (idempotent: no write when the
// module already shows). Non-hook counterpart of useScopeConfigActions
// .toggleModule, for the flows that materialize a module's content —
// creating a business-object listing enables the module of its type so the
// new list is reachable right away. `appConfig` feeds the org defaults of a
// scope without a row.
export default async function enableScopeModuleService({
  scopeId,
  projectId,
  moduleKey,
  appConfig,
}) {
  if (!scopeId || !moduleKey) return false;
  const defaultDisabledModuleKeys = getDefaultDisabledModuleKeys(appConfig);
  return upsertScopeConfigService({
    scopeId,
    projectId,
    defaultDisabledModuleKeys,
    computePatch: (row) => {
      const disabled = getEffectiveDisabledModuleKeys(
        row,
        defaultDisabledModuleKeys
      );
      if (!disabled.includes(moduleKey)) return null;
      return { disabledModuleKeys: disabled.filter((k) => k !== moduleKey) };
    },
  });
}
