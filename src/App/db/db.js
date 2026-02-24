import Dexie from "dexie";
import "dexie-export-import";

import store from "App/store";
import { UNDO_TABLES, _skipUndo, pushUndo } from "./undoManager";

function getCurrentUserIdMaster() {
  const state = store.getState();
  return state.auth.userProfile?.userIdMaster || 'anonymous';
}

const db = new Dexie("appDB");

db.version(12).stores({
  orgaData: "key", // {key,data,dataStructure,file}
  projects: "id,clientRef,__importTag",

  projectFiles: "id",

  scopes: "id,projectId", // {id,name,projectId,sortedListings:[{id,table}]}. Table is used to resolve syncConfig
  baseMaps: "id,listingId,projectId",
  baseMapViews: "id,scopeId,baseMapId",
  baseMapTransforms: "id", // {id, description, prompt}
  blueprints: "id,projectId,scopeId,listingId",

  listings: "id,key,uniqueByProject,projectId",
  entities: "id,projectId,listingId,[listingId+createdBy]",

  maps: "id,projectId,listingId,[listingId+createdBy]",

  zonings: "listingId", // {listingId,zonesTree}
  materials: "id,projectId,listingId,[listingId+createdBy]",

  relsZoneEntity: "id,projectId,listingId,zoneId,entityId", // {id,projectId,zoningId,zoneId,listingId,entityId,relListingId,relId}
  entitiesProps:
    "id,[listingKey+targetEntityId],listingKey,targetListingKey,targetEntityId", // entityProps = {id,tarketListingKey,targetEntityId,props}

  legends: "id,listingId",
  markers: "id,mapId,listingId,targetEntityId", // marker = {id,mapId,x,y,listingId,targetEntityId,createdBy,createdAt,updatedAt}

  points: "id,projectId,listingId,baseMapId",

  annotations: "id,projectId,baseMapId,listingId,entityId,annotationTemplateId", // annotation = {id,mapId,listingId,entityId,...}
  annotationTemplates: "id,projectId,listingId,code,label", // annotationTemplate = {id,listingId,label} code = listingKey+MARKER+...

  files: "fileName,projectId,listingId,entityId", // {fileName (=id), srcFileName, projectId, listingId, entityId, fileMime,fileType} fileType: "IMAGE", "VIDEO",...

  relationsEntities: "id,listingId,sourceEntityId,targetEntityId,relationType",
  reports: "id,listingId", // {id,listingId}
  syncFiles: "path,scopeId", // {path,updatedAt,updatedAtRemote,syncAt,syncFileType,scopeId,table,config,pathToItemTemplate} // updatedAt = local updates when one table is updated.// syncFileType: "PROJECT", "SCOPE", "LISTING","ENTITY", "FILE" => related to syncConfig.
});

db.version(13).stores({
  portfolios: "id,scopeId,projectId",
  portfolioPages: "id,portfolioId,scopeId,projectId",
  portfolioBaseMapContainers: "id,portfolioPageId,scopeId,projectId",
});

// --- AUDIT HOOKS ---

const AUDIT_TABLES = [
  "projects",
  "scopes",
  "listings",
  "entities",
  "maps",
  "baseMaps",
  "baseMapViews",
  "blueprints",
  "annotations",
  "annotationTemplates",
  "markers",
  "points",
  "zonings",
  "materials",
  "relsZoneEntity",
  "entitiesProps",
  "legends",
  "relationsEntities",
  "reports",
  "files",
  "baseMapTransforms",
  "portfolios",
  "portfolioPages",
  "portfolioBaseMapContainers",
];

AUDIT_TABLES.forEach((tableName) => {
  db[tableName].hook("creating", function (primKey, obj) {
    obj.createdAt = obj.createdAt || new Date().toISOString();
    obj.createdByUserIdMaster =
      obj.createdByUserIdMaster || getCurrentUserIdMaster();
    obj.updatedAt = obj.updatedAt || new Date().toISOString();
  });

  db[tableName].hook("updating", function (modifications) {
    if (!modifications.updatedAt) {
      return { ...modifications, updatedAt: new Date().toISOString() };
    }
    return modifications;
  });
});

// --- UNDO HOOKS ---

UNDO_TABLES.forEach((tableName) => {
  db[tableName].hook("creating", function (primKey, obj) {
    if (_skipUndo) return;
    const snapshot = { ...obj };
    this.onsuccess = (key) => {
      pushUndo({
        table: tableName,
        type: "create",
        key,
        before: null,
        after: { ...snapshot, id: key },
      });
    };
  });

  db[tableName].hook("updating", function (modifications, primKey, obj) {
    if (_skipUndo) return;
    const before = { ...obj };
    this.onsuccess = () => {
      pushUndo({
        table: tableName,
        type: "update",
        key: primKey,
        before,
        after: { ...obj, ...modifications },
      });
    };
  });
});

// --- SOFT DELETE MIDDLEWARE ---

const SOFT_DELETE_TABLES = new Set([
  "listings",
  "entities",
  "maps",
  "baseMaps",
  "baseMapViews",
  "blueprints",
  "annotations",
  "annotationTemplates",
  "markers",
  "points",
  "zonings",
  "materials",
  "relsZoneEntity",
  "entitiesProps",
  "legends",
  "relationsEntities",
  "reports",
  "portfolios",
  "portfolioPages",
  "portfolioBaseMapContainers",
]);

let _skipSoftDelete = false;

export function withHardDelete(fn) {
  _skipSoftDelete = true;
  return Promise.resolve(fn()).finally(() => {
    _skipSoftDelete = false;
  });
}

async function softDeleteByKeys(downlevelTable, req, tableName) {
  const existingRecords = await downlevelTable.getMany({
    trans: req.trans,
    keys: req.keys,
    cache: "immutable",
  });

  const now = new Date().toISOString();
  const deletedByUserIdMaster = getCurrentUserIdMaster();
  const valuesToPut = [];
  const undoEntries = [];

  for (let i = 0; i < req.keys.length; i++) {
    const record = existingRecords[i];
    if (record && !record.deletedAt) {
      const softDeleted = {
        ...record,
        deletedAt: now,
        deletedByUserIdMaster,
        updatedAt: now,
      };
      valuesToPut.push(softDeleted);

      if (UNDO_TABLES.has(tableName)) {
        undoEntries.push({
          table: tableName,
          type: "delete",
          key: req.keys[i],
          before: { ...record },
          after: { ...softDeleted },
        });
      }
    }
  }

  if (valuesToPut.length === 0) {
    return { numFailures: 0, failures: {}, lastResult: undefined };
  }

  const result = await downlevelTable.mutate({
    type: "put",
    trans: req.trans,
    values: valuesToPut,
  });

  undoEntries.forEach((entry) => pushUndo(entry));

  return result;
}

async function softDeleteByRange(downlevelTable, req, tableName) {
  const queryResult = await downlevelTable.query({
    trans: req.trans,
    query: { index: req.range.index ?? null, range: req.range },
    values: true,
  });

  const now = new Date().toISOString();
  const deletedByUserIdMaster = getCurrentUserIdMaster();

  const recordsToDelete = queryResult.result.filter(
    (record) => !record.deletedAt
  );

  const valuesToPut = recordsToDelete.map((record) => ({
    ...record,
    deletedAt: now,
    deletedByUserIdMaster,
    updatedAt: now,
  }));

  if (valuesToPut.length === 0) {
    return { numFailures: 0, failures: {}, lastResult: undefined };
  }

  const result = await downlevelTable.mutate({
    type: "put",
    trans: req.trans,
    values: valuesToPut,
  });

  if (UNDO_TABLES.has(tableName)) {
    recordsToDelete.forEach((record, i) => {
      pushUndo({
        table: tableName,
        type: "delete",
        key: record.id ?? record.listingId,
        before: { ...record },
        after: { ...valuesToPut[i] },
      });
    });
  }

  return result;
}

db.use({
  stack: "dbcore",
  name: "SoftDeleteMiddleware",
  create(downlevelDatabase) {
    return {
      ...downlevelDatabase,
      table(tableName) {
        const downlevelTable = downlevelDatabase.table(tableName);

        if (!SOFT_DELETE_TABLES.has(tableName)) {
          return downlevelTable;
        }

        return {
          ...downlevelTable,

          mutate(req) {
            if (_skipSoftDelete) {
              return downlevelTable.mutate(req);
            }

            if (req.type === "delete") {
              return softDeleteByKeys(downlevelTable, req, tableName);
            }

            if (req.type === "deleteRange") {
              return softDeleteByRange(downlevelTable, req, tableName);
            }

            return downlevelTable.mutate(req);
          },
        };
      },
    };
  },
});

export default db;
