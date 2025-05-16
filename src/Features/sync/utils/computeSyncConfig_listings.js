import computeSyncFilePathTemplates from "./computeSyncFilePathTemplates";
import computeSyncFileGetItemsRules from "./computeSyncFileGetItemsRules";

export default function computeSyncConfig_listings({listings, direction}) {
  const templates = computeSyncFilePathTemplates({syncFileType: "LISTING"});
  const rules = computeSyncFileGetItemsRules({syncFileType: "LISTING"});
  return {
    listings: {
      priority: 3,
      syncFile: {
        key: "LISTING",
        description: "Listing data",
        ...templates,
        localData: {
          table: "listings",
          ...rules,
        },
      },
      direction,
      computedContext: {
        listingsIds: {
          doNotResolve: true,
          value: listings.map((l) => l.id),
          //from: "scope.sortedListings",
          //transform: {type: "map", key: "id"},
        },
      },
      remoteMetadata: {
        fetchBy: "SINGLE_FOLDER",
        filterFilesById: {
          template: "_listing_{{id}}.json",
          in: "listingsIds",
        },
      },
      remoteToLocal: {
        fetchBy: "FILE",
      },
      localToRemote: {
        writeMode: "TABLE_ENTRY_TO_DATA",
        mode: "ONE_FILE_BY_ENTRY",
        filterEntries: [{key: "id", in: "listingsIds"}],
      },
    },
  };
}
