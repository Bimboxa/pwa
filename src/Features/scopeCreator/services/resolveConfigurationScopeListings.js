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
  extraLibraryKeys,
  excludedLibraryKeys,
  initSystemAnnotationTemplates,
}) {
  // helpers — extraLibraryKeys: creation options (e.g. "Carnet de détail"
  // adds the DIVERS library) on top of the configuration's own keys; also
  // usable with configuration null (generic scope + options).
  // excludedLibraryKeys: libraries removed by the user in the recap modal
  // (never applies to the system isForBaseMaps listings below).
  // initSystemAnnotationTemplates: create the system isForBaseMaps listings
  // (baseMap annotation templates). Explicit arg > configuration field
  // (annotations.initSystemAnnotationTemplates) > false.

  const libraryKeys = [
    ...(configuration?.annotations?.libraryKeys ?? []),
    ...(extraLibraryKeys ?? []),
  ].filter((key) => !(excludedLibraryKeys ?? []).includes(key));

  // system isForBaseMaps listings — opt-in

  const withSystem =
    initSystemAnnotationTemplates ??
    configuration?.annotations?.initSystemAnnotationTemplates ??
    false;

  const isForBaseMapsKeys = withSystem
    ? Object.values(appConfig?.presetListingsObject ?? {})
        .filter((l) => l.isForBaseMaps)
        .map((l) => l.key)
    : [];

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
