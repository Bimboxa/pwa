import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function usePresetScopes() {
  const appConfig = useAppConfig();

  if (!appConfig?.presetScopesObject) return null;

  return Object.values(appConfig.presetScopesObject);
}
