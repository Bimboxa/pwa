export const syncFileByItemType = {
  PROJECT: {
    key: "PROJECT",
    description: "Project data",
    remoteFolder: "{{remoteContainer.projectsPath}}/{{clientRef}}/_data",
    remoteFile: "_project.json",
    localData: {
      table: "projects",
      getItemFromKey: "clientRef",
    },
  },
  SCOPE: {
    key: "SCOPE",
    description: "Scope data",
    remoteFolder:
      "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
    remoteFile: "_scope_{{id}}.json",
    localData: {
      table: "scopes",
      getItemFromKey: "id",
    },
  },
  LISTING: {
    key: "LISTING",
    description: "Listing data",
    remoteFolder:
      "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_listings",
    remoteFile: "_listing_{{id}}.json",
    localData: {
      table: "listings",
      getItemFromKey: "id",
    },
  },
  ENTITY: {
    key: "ENTITY",
    description: "Entities items of one listing",
    remoteFolder:
      "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_entities/_listing_{{listingId}}",
    remoteFile: "_{{createdBy}}.json",
    localData: {
      table: "entities",
      getItemsFromKeys: ["listingId", "createdBy"],
    },
  },
  IMAGE: {
    key: "IMAGE",
    remoteFolder:
      "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_images/_listing_{{listingId}}/_{{createdBy}}",
    remoteFile: "{{fileName}}",
    localData: {
      table: "files",
      filterBy: {key: "fileType", value: "IMAGE"},
      getItemFromKey: "fileName",
    },
  },
};

const syncConfig = {
  project: {
    priority: 1,
    syncFile: syncFileByItemType["PROJECT"],
    direction: "BOTH",
    remoteMetadata: {
      fetchBy: "FILE",
      itemFromContext: "project",
    },
    remoteToLocal: {
      fetchBy: "FILE",
      itemFromContext: "project",
    },
    localToRemote: {
      writeMode: "TABLE_ENTRY_TO_DATA",
      mode: "SINGLE_FILE",
      entry: "project",
    },
  },
  scope: {
    priority: 2,
    syncFile: syncFileByItemType["SCOPE"],
    direction: "BOTH",
    remoteMetadata: {
      fetchBy: "FILE",
      itemFromContext: "scope",
    },
    remoteToLocal: {
      fetchBy: "FILE",
      itemFromContext: "scope",
    },
    localToRemote: {
      writeMode: "TABLE_ENTRY_TO_DATA",
      mode: "SINGLE_FILE",
      entry: "scope",
    },
  },
  listings: {
    priority: 3,
    syncFile: syncFileByItemType["LISTING"],
    direction: "BOTH",
    computedContext: {
      listingsIds: {
        from: "scope.sortedListings",
        transform: {type: "map", key: "id"},
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
  entities: {
    priority: 4,
    syncFile: syncFileByItemType["ENTITY"],
    direction: "BOTH",
    computedContext: {
      entitiesListingsIds: {
        from: "scope.sortedListings",
        filters: [{key: "table", value: "entities"}],
        transform: {type: "map", key: "id"},
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
  },
  images: {
    priority: 5,
    syncFile: syncFileByItemType["IMAGE"],
    direction: "BOTH",
    computedContext: {
      listingsIds: {
        from: "scope.sortedListings",
        transform: {type: "map", key: "id"},
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
      itemPathSeparator: "/_images/",
      pathToItemTemplate: "_listing_{{listingId}}/_{{createdBy}}/{{fileName}}",
    },
    localToRemote: {
      writeMode: "TABLE_ENTRY_TO_FILE",
      mode: "ONE_FILE_BY_ENTRY",
      filterEntries: [
        {key: "listingId", in: "listingsIds"},
        {key: "isImage", value: true},
      ],
    },
  },
};

export default syncConfig;
