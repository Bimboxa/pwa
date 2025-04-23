import syncFileTypeByItemType from "./data/syncFileTypeByItemType";

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
    priority: 1,
    description: "Project data",
    syncContext: ["remoteContainer", "project"],
    syncFileType: syncFileTypeByItemType.PROJECT,
    direction: "BOTH",
    localTable: "projects",
    remoteToLocal: {
      fetchMode: "SINGLE_FILE",
      mode: "DATA_TO_TABLE_ENTRY",
      remoteFolder:
        "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
      remoteFile: "_project.json",
    },
    localToRemote: {
      postMode: "SINGLE_FILE",
      mode: "TABLE_ENTRY_TO_DATA",
      findEntry: [{key: "id", value: "project.id"}],
      remoteFolder:
        "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
      remoteFile: "_project.json",
    },
  },
  scope: {
    priority: 2,
    description: "Data of the selected scope",
    syncContext: ["remoteContainer", "project", "scope"],
    syncFileType: syncFileTypeByItemType.SCOPE,
    localTable: "scopes",
    direction: "BOTH",
    remoteToLocal: {
      fetchMode: "SINGLE_FILE",
      mode: "DATA_TO_TABLE_ENTRY",
      remoteFolder:
        "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
      remoteFile: "_scope_{{scope.id}}.json",
    },
    localToRemote: {
      postMode: "SINGLE_FILE",
      mode: "TABLE_ENTRY_TO_DATA",

      findEntry: [{key: "id", value: "scope.id"}],
      remoteFolder:
        "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
      remoteFile: "_scope_{{scope.id}}.json",
    },
  },
  // relsScopeItem: {
  //   priority: 3,
  //   description: "Listings for one scope",
  //   syncContext: ["remoteContainer", "project", "scope"],
  //   syncFileType: syncFileTypeByItemType.RELS_SCOPE_ITEM,
  //   localTable: "relsScopeItem",
  //   direction: " BOTH",
  //   remoteToLocal: {
  //     fetchMode: "SINGLE_FILE",
  //     mode: "ITEMS_TO_TABLE_ENTRIES",
  //     remoteFolder:
  //       "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
  //     remoteFile: "_relsScopeItem_{{scope.id}}.json",
  //   },
  //   localToRemote: {
  //     postMode: "SINGLE_FILE",
  //     mode: "TABLE_ENTRIES_TO_ITEMS",
  //     filterEntries: [{key: "scopeId", value: "scope.id"}],
  //     remoteFolder:
  //       "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
  //     remoteFile: "_relsScopeItem_{{scope.id}}.json",
  //   },
  // },
  listings: {
    priority: 3,
    description: "List of listings for a scope",
    syncContext: ["remoteContainer", "project", "listings"],
    syncFileType: syncFileTypeByItemType.LISTING,
    localTable: "listings",
    direction: "BOTH",
    remoteToLocal: {
      fetchMode: "FOLDER",
      mode: "DATA_TO_TABLE_ENTRY",
      remoteFolder:
        "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
      filterFiles: [
        {
          remoteFiles: "_listing_{{id}}.json",
          key: "id",
          in: "scope.sortedListingsIds",
        },
      ],
    },
    localToRemote: {
      postMode: "MULTI_FILES",
      mode: "TABLE_ENTRY_TO_DATA",
      filterEntries: [{key: "id", in: "scope.sortedListingsIds"}],
      groupEntriesBy: ["id"],
      remoteFolder:
        "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
      remoteFile: "_listing_{{id}}.json",
    },
  },

  entities: {
    priority: 5,
    description: "Entities for one listing",
    syncContext: ["remoteContainer", "project", "listings"],
    syncFileType: syncFileTypeByItemType.ENTITY,
    localTable: "entities",
    direction: "BOTH",
    remoteToLocal: {
      fetchMode: "MULTI_FOLDERS",
      mode: "ITEMS_TO_TABLE_ENTRIES",
      remoteFolder:
        "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_listings/_data_{{id}}",
      filterFolders: [{key: "id", in: "listings.id"}],
      filterFiles: null,
    },
    localToRemote: {
      postMode: "MULTI_FILES",
      mode: "TABLE_ENTRIES_TO_ITEMS",
      filterEntries: [{key: "listingId", in: "listings.id"}],
      groupEntriesBy: ["listingId", "createdBy"],
      remoteFolder:
        "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_listings/_data_{{listingId}}",
      remoteFile: "_{{listingId}}_{{createdBy}}.json",
    },
  },
  images: {
    priority: 6,
    description: "Images for one listing",
    syncContext: ["remoteContainer", "project", "listingsIds"],
    syncFileType: syncFileTypeByItemType.IMAGE,
    localTable: "files",
    direction: "BOTH",
    remoteToLocal: {
      fetchMode: "MULTI_SUBFOLDERS",
      mode: "FILES_REMOTE_TO_LOCAL",
      remoteFolder:
        "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_listings/_data_{{listingId}}",
      filterFolders: [{key: "listingId", in: "listings.id"}],
      filterSubfolders: null,
    },
    localToRemote: {
      postMode: "MULTI_FILES",
      mode: "FILES_LOCAL_TO_REMOTE",
      filterEntries: [
        {key: "listingId", in: "listings.id"},
        {key: "isImage", value: true},
      ],
      groupEntriesBy: ["listingId", "createdBy"],
      remoteFolder:
        "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_listings/_data_{{listingId}}/_images_{{createdBy}}",
      remoteFile: "{{file.name}}",
    },
  },
};

export default syncConfig;
