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
  // helpers

  const presetScope = appConfig?.presetScopesObject?.[presetScopeKey];
  const presetListingsKeys = presetScope?.listings ?? [];

  // add isForBaseMaps listings

  const isForBaseMapsKeys = Object.values(
    appConfig?.presetListingsObject ?? {}
  )
    .filter((l) => l.isForBaseMaps)
    .map((l) => l.key);

  const allKeys = [
    ...new Set([...presetListingsKeys, ...isForBaseMapsKeys]),
  ];

  // edge case — no listings to create

  if (allKeys.length === 0) return [];

  // main

  return resolvePresetListings({
    projectId,
    appConfig,
    presetListingsKeys: allKeys,
  });
}
