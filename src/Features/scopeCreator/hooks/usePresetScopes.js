import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function usePresetScopes() {
  const appConfig = useAppConfig();

  //if (!appConfig?.presetScopesObject || !appConfig.presetScopesSortedKeys) return null;

  const keys = appConfig?.presetScopesSortedKeys;
  return keys?.map(key => appConfig?.presetScopesObject[key]);
}
