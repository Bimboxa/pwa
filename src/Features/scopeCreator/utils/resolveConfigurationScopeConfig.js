import {
  getDefaultDisabledModuleKeys,
  getDisabledModuleKeysFromEnabled,
} from "Features/scopeConfig/utils/scopeConfigSelectors";

// A Krto configuration's `scopeConfig` field ({ enabledModuleKeys,
// disabledToolKeys, disabledToolKeysByModule }) -> createScopeConfig props
// (persisted form, disabledModuleKeys). enabledModuleKeys lists the non-core
// modules to enable ([] => core only); absent => org default. Tool fields
// pass through unchanged (undefined => createScopeConfig applies its
// defaults).
export default function resolveConfigurationScopeConfig(
  scopeConfig,
  appConfig
) {
  const { enabledModuleKeys, ...rest } = scopeConfig ?? {};
  return {
    ...rest,
    disabledModuleKeys: enabledModuleKeys
      ? getDisabledModuleKeysFromEnabled(enabledModuleKeys)
      : [...getDefaultDisabledModuleKeys(appConfig)],
  };
}
