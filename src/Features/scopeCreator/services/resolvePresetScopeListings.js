/*
 * Resolve listings to create from a preset scope.
 * Delegates to resolvePresetListings with the scope's listing keys.
 */

import resolvePresetListings from "Features/listings/services/resolvePresetListings";

export default async function resolvePresetScopeListings({
  presetScopeKey,
  appConfig,
  projectId,
}) {
  // edge case

  if (!appConfig?.presetScopesObject?.[presetScopeKey]) return [];

  // helpers

  const presetScope = appConfig.presetScopesObject[presetScopeKey];
  const presetListingsKeys = presetScope?.listings;

  // main

  return resolvePresetListings({
    projectId,
    appConfig,
    presetListingsKeys,
  });
}
