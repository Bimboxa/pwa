const syncConfig = {
  // orgaListings: {
  //   description:
  //     "Listings defined at the organisation level. Mainly nomenclatures or organisation datasets.",
  //   syncContext: ["remoteContainer"],
  //   syncFileType: "ORGA_LISTING",
  //   remoteFolder: "/_data",
  //   remoteFile: "_listing_{{listing.id}}.json",
  //   localTable: "orgaListings",
  //   direction: "PULL",
  //   remoteToLocal: {mode: "ISO"},
  // },
  // orgaEntities: {
  //   description:
  //     "Entities of the organisation listings. Categories (nomenclatures) or key value pairs for datasets",
  //   syncContext: ["remoteContainer"],
  //   syncFileType: "ORGA_ENTITIES",
  //   remoteFolder: "/_listings",
  //   remoteFile: "_{{listing.key}}_{{listing.id}}.json",
  //   localTable: "orgaEntities",
  //   direction: "PULL",
  //   remoteToLocal: {mode: "ITEMS_ITEM_TO_TABLE_ENTRY"},
  // },
  project: {
    description: "Project data",
    syncContext: ["remoteContainer", "project"],
    syncFileType: "PROJECT",
    remoteFolder: "{{remoteContainer.projectsPath}}/{{project.clientRef}}",
    remoteFile: "/_data/project.json",
    localTable: "projects",
    direction: "BOTH",
    remoteToLocal: {mode: "DATA_TO_TABLE_ENTRY"},
    localToRemote: {
      mode: "TABLE_ENTRY_TO_DATA",
      postMode: "SINGLE_FILE",
      findEntry: [{key: "id", value: "project.id"}],
    },
  },
  scope: {
    description: "Data of the selected scope",
    syncContext: ["remoteContainer", "project", "scope"],
    syncFileType: "SCOPE",
    remoteFolder:
      "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
    remoteFile: "_scope_{{scope.id}}.json",
    localTable: "scopes",
    direction: "BOTH",
    remoteToLocal: {
      mode: "DATA_TO_TABLE_ENTRY",
      fetchMode: "FILE",
    },
    localToRemote: {
      postMode: "SINGLE_FILE",
      mode: "TABLE_ENTRY_TO_DATA",
      findEntry: [{key: "id", value: "scope.id"}],
    },
  },
  listings: {
    description: "List of listings for a scope",
    syncContext: ["remoteContainer", "project", "listingsIds"],
    syncFileType: "LISTING",
    remoteFolder:
      "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
    remoteFile: "_listing_{{listing.id}}.json",
    localTable: "listings",
    direction: "BOTH",
    remoteToLocal: {
      mode: "DATA_TO_TABLE_ENTRY",
      fetchMode: "FOLDER",
      filterFiles: [{value: "{{listing.id}}", in: "listingsIds"}],
    },
    localToRemote: {
      mode: "TABLE_ENTRY_TO_DATA",
      postMode: "MULTI_FILES",
      filterEntries: [{key: "id", in: "listingsIds"}],
    },
  },
  relsScopeItem: {
    description: "Listings for one scope",
    syncContext: ["SCOPE"],
    syncFileType: "SCOPE_LISTINGS",
    remoteFolder:
      "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
    remoteFile: "_relsScopeItem_{{scope.id}}.json",
    localTable: "relsScopeItem",
    direction: " BOTH",
    remoteToLocal: {
      mode: "ITEMS_TO_TABLE_ENTRIES",
    },
    localToRemote: {
      mode: "TABLE_ENTRIES_TO_ITEMS",
      filterBy: "scopeId",
    },
  },
  entities: {
    description: "Entities for one listing",
    syncContext: ["remoteContainer", "project", "listingsIds"],
    syncFileType: "LISTING_ENTITIES_BY_CREATOR",
    remoteFolder:
      "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_listings/_{{listing.key}}_{{listing.id}}",
    remoteFile: "_{{listing.id}}_{{entity.createdBy}}.json",
    localTable: "entities",
    direction: "BOTH",
    remoteToLocal: {
      fetchMode: "FOLDER",
      filterFiles: null,
      mode: "ITEMS_TO_TABLE_ENTRIES",
    },
    localToRemote: {
      postMode: "MULTI_FILES",
      mode: "TABLE_ENTRIES_TO_ITEMS",
      filterEntries: [{key: "listingId", in: "listingsIds"}],
      groupEntriesBy: ["listingId", "createdBy"],
    },
  },
};

export default syncConfig;
