import computeSyncFileGetItemsRules from "./computeSyncFileGetItemsRules";
import computeSyncFilePathTemplates from "./computeSyncFilePathTemplates";

export default function computeSyncConfig_entities({direction, listings}) {
  // helper
  const listingsByTable = listings.reduce((ac, listing) => {
    if (ac[listing.table]) {
      ac[listing.table].push(listing);
    } else {
      ac[listing.table] = [listing];
    }
    return ac;
  }, {});

  const result = {};

  // helper - templates
  const templates = computeSyncFilePathTemplates({syncFileType: "ENTITIES"});
  const rules = computeSyncFileGetItemsRules({syncFileType: "ENTITIES"});

  Object.entries(listingsByTable).map(([table, listings], index) => {
    result[`entities_${table}`] = {
      priority: 4,
      syncFile: {
        key: `ENTITIES_${table}`,
        description: "Entities items of one listing",
        ...templates,
        localData: {
          table, // fill the table here
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
  });

  // return
  return result;
}
