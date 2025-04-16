import {filter} from "jszip";

export const syncConfig = {
  orgaListings: {
    description:
      "Listings defined at the organisation level. Mainly nomenclatures or organisation datasets.",
    syncDeps: ["REMOTE_CONTAINER"],
    syncFileType: "ORGA_LISTING",
    remoteFolder: "/_data",
    remoteFile: "_listing_{{listing.id}}.json",
    localTable: "orgaListings",
    direction: "PULL",
    remoteToLocal: {mode: "ISO"},
  },
  orgaEntities: {
    description:
      "Entities of the organisation listings. Categories (nomenclatures) or key value pairs for datasets",
    syncDeps: ["REMOTE_CONTAINER"],
    syncFileType: "ORGA_ENTITIES",
    remoteFolder: "/_listings",
    remoteFile: "_{{listing.key}}_{{listing.id}}.json",
    localTable: "orgaEntities",
    direction: "PULL",
    remoteToLocal: {mode: "ITEMS_ITEM_TO_TABLE_ENTRY"},
  },
  project: {
    description: "Project data",
    syncDeps: ["PROJECT"],
    syncFileType: "PROJECT",
    remoteFolder: "{{remoteContainer.projectsPath}}/{{project.clientRef}}",
    remoteFile: "/_data/project.json",
    localTable: "projects",
    direction: "BOTH",
    remoteToLocal: {mode: "DATA_TO_TABLE_ENTRY"},
    localToRemote: {
      code: "TABLE_ENTRY_TO_DATA",
      filterBy: "id",
    },
  },
  scopes: {
    description: "List of scopes for a project",
    syncDeps: ["PROJECT"],
    syncFileType: "SCOPE",
    remoteFolder:
      "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
    remoteFile: "_scope_{{scope.id}}.json",
    localTable: "scopes",
    direction: "BOTH",
    remoteToLocal: {
      mode: "DATA_TO_TABLE_ENTRY",
    },
    localToRemote: {mode: "TABLE_ENTRY_TO_DATA", filterBy: "id"},
  },
  listings: {
    description: "List of listings for a project",
    syncDeps: ["PROJECT"],
    syncFileType: "LISTING",
    remoteFolder:
      "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_data",
    remoteFile: "_listing_{{listing.id}}.json",
    localTable: "listings",
    direction: "BOTH",
    remoteToLocal: {
      mode: "DATA_TO_TABLE_ENTRY",
    },
    localToRemote: {mode: "TABLE_ENTRY_TO_DATA", filterBy: "id"},
  },
  relsScopeItem: {
    description: "Listings for one scope",
    syncDeps: ["SCOPE"],
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
    syncDeps: ["LISTING"],
    syncFileType: "LISTING_ENTITIES_BY_CREATOR",
    remoteFolder:
      "{{remoteContainer.projectsPath}}/{{project.clientRef}}/_listings/_{{listing.key}}_{{listing.id}}",
    remoteFile: "_{{listing.id}}_{{entity.createdBy}}.json",
    localTable: "entities",
    direction: "BOTH",
    remoteToLocal: {
      mode: "ITEMS_TO_TABLE_ENTRIES",
    },
    localToRemote: {
      mode: "TABLE_ENTRIES_TO_ITEMS",
      filterBy: ["listingId", "createdBy"],
    },
  },
};
