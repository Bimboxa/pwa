import computeSyncFilePathTemplates from "./computeSyncFilePathTemplates";
import computeSyncFileGetItemsRules from "./computeSyncFileGetItemsRules";

export default function computeSyncConfig_files({
  fileTypes,
  listings,
  direction,
}) {
  const result = {};

  fileTypes.map((fileType, index) => {
    // templates
    const templates = computeSyncFilePathTemplates({
      syncFileType: "FILE",
      fileType,
    });
    const rules = computeSyncFileGetItemsRules({syncFileType: "FILE"});

    // result
    result[`files_${fileType}`] = {
      priority: 5,
      syncFile: {
        key: fileType,
        fileType,
        ...templates,
        localData: {
          table: "files",
          filterBy: {key: "fileType", value: fileType, doNotResolve: true},
          ...rules,
        },
      },
      direction,
      computedContext: {
        listingsIds: {
          doNotResolve: true,
          value: listings.map((l) => l.id),
        },
      },
      remoteMetadata: {
        fetchBy: "ITERATION_PARENT_FOLDER",
        iteration: {
          key: "listingId",
          in: "listingsIds",
        },
      },
      remoteToLocal: {
        fetchBy: "FILE",
        itemPathSeparator: `/${templates.pathSeparator}/`,
        pathToItemTemplate:
          "_listing_{{listingId}}/_{{createdBy}}/{{fileName}}",
      },
      localToRemote: {
        writeMode: "TABLE_ENTRY_TO_FILE",
        mode: "ONE_FILE_BY_ENTRY",
        filterEntries: [
          {key: "listingId", in: "listingsIds"},
          {key: "fileType", value: fileType, doNotResolve: true},
        ],
      },
    };
  });

  // return
  return result;
}
