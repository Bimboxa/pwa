/*
 * Resolve listings to create from a Krto creation configuration.
 * The configuration's annotation library keys ARE preset-listing keys (one
 * preset listing per annotation templates library — see
 * resolvePresetListingsAndScopesObjectFromAnnotationTemplatesLibraries), so we
 * delegate to resolvePresetListings, like resolvePresetScopeListings does.
 */

import resolvePresetListings from "Features/listings/services/resolvePresetListings";

export default async function resolveConfigurationScopeListings({
  configuration,
  appConfig,
  projectId,
}) {
  // helpers

  const libraryKeys = configuration?.annotations?.libraryKeys ?? [];

  // add isForBaseMaps listings

  const isForBaseMapsKeys = Object.values(appConfig?.presetListingsObject ?? {})
    .filter((l) => l.isForBaseMaps)
    .map((l) => l.key);

  const allKeys = [...new Set([...libraryKeys, ...isForBaseMapsKeys])];

  // edge case — no listings to create

  if (allKeys.length === 0) return [];

  // main

  return resolvePresetListings({
    projectId,
    appConfig,
    presetListingsKeys: allKeys,
  });
}
