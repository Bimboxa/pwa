import {
  getDefaultDisabledModuleKeys,
  getDisabledModuleKeysFromEnabled,
  OPTIONAL_CORE_MODULE_KEYS,
} from "Features/scopeConfig/utils/scopeConfigSelectors";

// A Krto configuration's `scopeConfig` field ({ enabledModuleKeys,
// disabledCoreModuleKeys, disabledToolKeys, disabledToolKeysByModule }) ->
// createScopeConfig props (persisted form, disabledModuleKeys).
// enabledModuleKeys lists the non-core modules to enable ([] => core only);
// absent => org default. disabledCoreModuleKeys lists the optional core
// modules to disable (e.g. ["SCOPE"]; other keys ignored). Tool fields pass
// through unchanged (undefined => createScopeConfig applies its defaults).
export default function resolveConfigurationScopeConfig(
  scopeConfig,
  appConfig
) {
  const { enabledModuleKeys, disabledCoreModuleKeys, ...rest } =
    scopeConfig ?? {};
  const disabledCoreKeys = (disabledCoreModuleKeys ?? []).filter((k) =>
    OPTIONAL_CORE_MODULE_KEYS.includes(k)
  );
  return {
    ...rest,
    disabledModuleKeys: [
      ...(enabledModuleKeys
        ? getDisabledModuleKeysFromEnabled(enabledModuleKeys)
        : getDefaultDisabledModuleKeys(appConfig)),
      ...disabledCoreKeys,
    ],
  };
}
