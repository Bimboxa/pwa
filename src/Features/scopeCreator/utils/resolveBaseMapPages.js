/*
 * Single source of truth for the baseMap pages of a Krto about to be
 * created: which dossiers (baseMap listings) will exist, and in which one
 * each configuration page lands. Shared by the recap modal (render) and by
 * useCreateScopeFromPreset (creation) so both agree.
 *
 * Folder keys never get parsed by the consumers: they look the folder up
 * with folders.find((f) => f.targetKey === page.targetKey).
 */

export const getNewFolderKey = (name) => `new:${name}`;
export const getExistingFolderKey = (id) => `existing:${id}`;

// a page is keyed by its declaring dossier + its own name
export const getPageKey = (listingName, itemName) =>
  `${listingName}::${itemName}`;

// same predicate as createConfigurationBaseMaps: a project listing matched
// by name + verticalBaseMaps flag is reused instead of duplicated.
export function matchExistingListing(listingConfig, existingListings) {
  return (
    (existingListings ?? []).find(
      (l) =>
        l.name === listingConfig.name &&
        Boolean(l.verticalBaseMaps) === Boolean(listingConfig.verticalBaseMaps)
    ) ?? null
  );
}

export default function resolveBaseMapPages({
  listingConfigs,
  existingListings,
  removedListingNames,
  removedPageKeys,
  extraBaseMapListings,
  hiddenExistingListingIds,
  pageTargets,
}) {
  const _listingConfigs = listingConfigs ?? [];
  const _existingListings = existingListings ?? [];
  const _removedListingNames = removedListingNames ?? [];
  const _removedPageKeys = removedPageKeys ?? [];
  const _hiddenIds = hiddenExistingListingIds ?? [];
  const _pageTargets = pageTargets ?? {};

  // folders — creation order: configuration listings (new or matched), the
  // named "+ Ajouter" rows, then the remaining visible project listings.

  const folders = [];
  const seenKeys = new Set();
  function pushFolder(folder) {
    if (seenKeys.has(folder.targetKey)) return;
    seenKeys.add(folder.targetKey);
    folders.push(folder);
  }

  // key of the dossier a configuration listing resolves to, or null when it
  // produces no folder (removed, or fallback dropped by existing listings)
  const folderKeyByListingName = {};

  for (const listingConfig of _listingConfigs) {
    if (_removedListingNames.includes(listingConfig.name)) continue;
    if (listingConfig.fallback && _existingListings.length > 0) continue;
    const existing = matchExistingListing(listingConfig, _existingListings);
    if (existing) {
      const targetKey = getExistingFolderKey(existing.id);
      folderKeyByListingName[listingConfig.name] = targetKey;
      pushFolder({
        targetKey,
        kind: "existing",
        name: existing.name,
        listingConfig,
        existing,
        declared: true,
      });
    } else {
      const targetKey = getNewFolderKey(listingConfig.name);
      folderKeyByListingName[listingConfig.name] = targetKey;
      pushFolder({
        targetKey,
        kind: "new",
        name: listingConfig.name,
        listingConfig,
        declared: true,
      });
    }
  }

  for (const extra of extraBaseMapListings ?? []) {
    const name = extra?.name?.trim();
    if (!name) continue;
    pushFolder({
      targetKey: getNewFolderKey(name),
      kind: "new",
      name,
      declared: false,
    });
  }

  for (const existing of _existingListings) {
    if (_hiddenIds.includes(existing.id)) continue;
    pushFolder({
      targetKey: getExistingFolderKey(existing.id),
      kind: "existing",
      name: existing.name,
      existing,
      declared: false,
    });
  }

  // pages — every item of every configuration listing (a removed dossier
  // keeps its pages, re-targeted), minus the removed ones

  const pages = [];
  for (const listingConfig of _listingConfigs) {
    for (const item of listingConfig.items ?? []) {
      const pageKey = getPageKey(listingConfig.name, item.name);
      if (_removedPageKeys.includes(pageKey)) continue;
      const defaultTargetKey =
        folderKeyByListingName[listingConfig.name] ?? null;
      const storedTargetKey = _pageTargets[pageKey];
      const targetKey = seenKeys.has(storedTargetKey)
        ? storedTargetKey
        : seenKeys.has(defaultTargetKey)
          ? defaultTargetKey
          : (folders[0]?.targetKey ?? null);
      pages.push({
        ...item,
        pageKey,
        listingName: listingConfig.name,
        defaultTargetKey,
        targetKey,
      });
    }
  }

  return { folders, pages };
}
