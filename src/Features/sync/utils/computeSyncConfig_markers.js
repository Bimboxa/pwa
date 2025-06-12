import computeSyncFileGetItemsRules from "./computeSyncFileGetItemsRules";
import computeSyncFilePathTemplates from "./computeSyncFilePathTemplates";

export default function computeSyncConfig_markers({direction, listings}) {
  // helper
  const listingsWithMarkers = listings.filter((l) => l.enableMarkers);

  const result = {};

  // helper - templates
  const templates = computeSyncFilePathTemplates({syncFileType: "MARKERS"});
  const rules = computeSyncFileGetItemsRules({syncFileType: "MARKERS"});

  result[`entities_markers`] = {
    priority: 4,
    syncFile: {
      key: `MARKERS`,
      description: "Entities markers of one listing",
      ...templates,
      localData: {
        table: "markers", // fill the table here
        ...rules,
      },
    },
    direction,
    computedContext: {
      entitiesListingsIds: {
        doNotResolve: true,
        value: listings.map((l) => l.id),
      },
    },
    remoteMetadata: {
      fetchBy: "ITERATION_FOLDER",
      iteration: {
        key: "listingId",
        in: "entitiesListingsIds",
      },
    },
    remoteToLocal: {
      fetchBy: "FILE",
    },
    localToRemote: {
      writeMode: "TABLE_ENTRIES_TO_ITEMS",
      mode: "GROUP_ENTRIES_BY_FILE",
      filterEntries: [{key: "listingId", in: "entitiesListingsIds"}],
      groupEntriesBy: ["listingId", "createdBy"],
    },
  };

  // return
  return result;
}
