import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useProjectPresetScopes() {
  const appConfig = useAppConfig();

  const presetListingsObject = appConfig?.presetListingsObject;
  const presetScopesObject = appConfig?.presetScopesObject;

  // edge case

  if (!presetScopesObject || !presetListingsObject) return [];

  // main
  const presetScopes = Object.values(presetScopesObject).map((scope) => {
    return {
      ...scope,
      listings: scope.listings.map((listingKey) => {
        return presetListingsObject[listingKey];
      }),
    };
  });

  return presetScopes;
}
