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
    remoteFolder:
      "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
    remoteFile: "_project.json",
    localTable: "projects",
    direction: "BOTH",
    remoteToLocal: {fetchMode: "SINGLE_FILE", mode: "DATA_TO_TABLE_ENTRY"},
    localToRemote: {
      postMode: "SINGLE_FILE",
      mode: "TABLE_ENTRY_TO_DATA",
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
      fetchMode: "SINGLE_FILE",
      mode: "DATA_TO_TABLE_ENTRY",
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
      fetchMode: "FOLDER",
      mode: "DATA_TO_TABLE_ENTRY",
      filterFiles: [{value: "{{listing.id}}", in: "listingsIds"}],
    },
    localToRemote: {
      postMode: "MULTI_FILES",
      mode: "TABLE_ENTRY_TO_DATA",
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
      fetchMode: "SINGLE_FILE",
      mode: "ITEMS_TO_TABLE_ENTRIES",
    },
    localToRemote: {
      postMode: "SINGLE_FILE",
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
  images: {
    description: "Images for one listing",
    syncContext: ["remoteContainer", "project", "listingsIds"],
    syncFileType: "IMAGE",
    remoteFolder:
      "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_listings/_{{listing.key}}_{{listing.id}}/_images_{{file.createdBy}}",
    remoteFile: "{{file.name}}",
    localTable: "files",
    direction: "BOTH",
    remoteToLocal: {
      fetchMode: "FOLDER",
      filterFiles: null,
      mode: "FILES_REMOTE_TO_LOCAL",
    },
    localToRemote: {
      postMode: "MULTI_FILES",
      mode: "FILES_LOCAL_TO_REMOTE",
      filterEntries: [
        {key: "listingId", in: "listingsIds"},
        {key: "isImage", value: true},
      ],
      groupEntriesBy: ["listingId", "createdBy"],
    },
  },
};

export default syncConfig;
