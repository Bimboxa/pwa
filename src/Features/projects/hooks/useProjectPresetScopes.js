import useAppConfig from "App/hooks/useAppConfig";

export default function useProjectPresetScopes() {
  const appConfig = useAppConfig();

  const presetListingsMap = appConfig?.presetListingsMap;
  const presetScopesObject = appConfig?.presetScopesObject;

  // edge case

  if (!presetScopesObject) return [];

  // main
  const presetScopes = Object.values(presetScopesObject).map((scope) => {
    return {
      ...scope,
      listings: scope.listings.map((listingKey) => {
        return presetListingsMap[listingKey];
      }),
    };
  });

  return presetScopes;
}
