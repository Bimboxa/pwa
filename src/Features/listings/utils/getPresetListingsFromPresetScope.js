export default function getPresetListingsFromPresetScope(
  presetScopeKey,
  appConfig
) {
  // edge case
  if (!appConfig || !presetScopeKey) return [];

  //main

  const presetListingsObject = appConfig.presetListingsObject;
  const presetScopesObject = appConfig.presetScopesObject;

  const presetScope = presetScopesObject?.[presetScopeKey];

  // edge case

  if (!presetScope || !presetScope.listings) return [];

  // step 1 - add ids to listings

  let listings = presetScope.listings.map((listingKey) => {
    return presetListingsObject[listingKey];
  });

  return listings;
}
