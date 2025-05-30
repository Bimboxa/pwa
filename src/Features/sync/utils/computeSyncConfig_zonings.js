import computeSyncFileGetItemsRules from "./computeSyncFileGetItemsRules";
import computeSyncFilePathTemplates from "./computeSyncFilePathTemplates";

export default function computeSyncConfig_zonings({direction, listings}) {
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
  const templates = computeSyncFilePathTemplates({syncFileType: "ZONING"});
  const rules = computeSyncFileGetItemsRules({syncFileType: "ZONING"});

  Object.entries(listingsByTable).map(([table, listings], index) => {
    result[`zonings_${table}`] = {
      priority: 4,
      syncFile: {
        key: `ZONING_${table}`,
        description: "zoning of one listing",
        ...templates,
        localData: {
          table, // fill the table here
          ...rules,
        },
      },
      direction,
      computedContext: {
        zoningListingsIds: {
          doNotResolve: true,
          value: listings.map((l) => l.id),
        },
      },
      remoteMetadata: {
        fetchBy: "ITERATION_FILE",
        iteration: {
          key: "listingId",
          in: "zoningListingsIds",
        },
      },
      remoteToLocal: {
        fetchBy: "FILE",
      },
      localToRemote: {
        writeMode: "TABLE_ENTRY_TO_DATA",
        mode: "ONE_FILE_BY_ENTRY",
        filterEntries: [{key: "listingId", in: "listingsIds"}],
      },
    };
  });

  // return
  return result;
}
