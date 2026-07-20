import Dexie from "dexie";
import "dexie-export-import";
import { nanoid } from "@reduxjs/toolkit";

import store from "App/store";
import { UNDO_TABLES, _skipUndo, pushUndo } from "./undoManager";
import { canEditRecord, OwnershipError } from "./ownership";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";
import { notifyLocalChange } from "Features/remoteScopeConfigurations/services/localChangeTracker";

function getCurrentUserIdMaster() {
  const state = store.getState();
  const id = getUserIdMaster(state.auth.userProfile);
  return id != null ? String(id) : "anonymous";
}

// --- OWNERSHIP GUARD BYPASS ---
// When active, the ownership guard and the `updatedByUserIdMaster` auto-stamp
// are skipped. Used by legitimate inter-user flows (Krto/scope import, remote
// sync) that write records owned by other users, and by parent-authorized
// cascade deletes.
let _skipOwnershipGuard = false;

export function withSystemWrite(fn) {
  const previous = _skipOwnershipGuard;
  _skipOwnershipGuard = true;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      _skipOwnershipGuard = previous;
    });
}

const db = new Dexie("appDB");

db.version(12).stores({
  orgaData: "key", // {key,data,dataStructure,file}
  projects: "id,clientRef,__importTag",

  projectFiles: "id",

  scopes: "id,projectId", // {id,name,projectId}
  baseMaps: "id,listingId,projectId",
  baseMapViews: "id,scopeId,baseMapId",
  baseMapTransforms: "id", // {id, description, prompt}
  blueprints: "id,projectId,scopeId,listingId",

  listings: "id,key,uniqueByProject,projectId,scopeId",
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

db.version(14).stores({
  portfolios: null,
  portfolioPages: "id,listingId,scopeId,projectId",
});

db.version(15).stores({
  entityModels: "id, projectId, key",
});

db.version(16).stores({
  // {id, annotationId, nomenclatureKey, categoryKey, projectId}
  relAnnotationMappingCategory:
    "id, annotationId, projectId, [nomenclatureKey+categoryKey]",
});

db.version(17).stores({});

db.version(18).stores({
  baseMapVersions: "id,baseMapId,projectId,listingId",
});

db.version(19).stores({
  layers: "id,baseMapId,projectId",
});

db.version(20).stores({
  layers: "id,baseMapId,projectId,scopeId",
});

db.version(21).stores({
  // {id, projectId, sourceAnnotationId, targetAnnotationId}
  // Directional subtraction relation: sourceAnnotation - targetAnnotation
  // (3D boolean + quantity impact). Soft-deleted when either annotation is deleted.
  relAnnotationSubtractions:
    "id, projectId, sourceAnnotationId, targetAnnotationId",
});

db.version(22).stores({
  // {id, projectId, parentAnnotationId, meshCellAnnotationId}
  // Mesh relation: links a parent annotation to a mesh cell annotation it was
  // subdivided into ("maillage"). Soft-deleted when either annotation is deleted.
  relAnnotationMeshCells:
    "id, projectId, parentAnnotationId, meshCellAnnotationId",
});

db.version(23).stores({
  // {id, projectId, scopeId, a:{x,y,z}, b:{x,y,z}, length}
  // LEGACY — no longer read/written: 3D cotes are now standard COTE
  // annotations (drawn via a template + commitDrawnCoteService). The table
  // stays in the schema to avoid a version bump; old records are dead.
  dimensions3d: "id,projectId,scopeId,[projectId+scopeId]",
});

db.version(24).stores({
  // {id, projectId, scopeId, number, label, color, surface, faces, sourceInfo}
  // 3D mesh cell ("maille"): a first-class 3D-only object made of one or
  // several planar face loops (faces: [{contour:[{x,y,z}], holes, normal}]) in
  // three.js world coordinates. `surface` (m²) caches the sum of face areas.
  // `number` is allocated at creation and never reused (numbering includes
  // soft-deleted rows); display label = label ?? prefix + number.
  meshes3d: "id,projectId,scopeId,[projectId+scopeId]",
});

db.version(25).stores({
  // {id, projectId, scopeId, sortIndex, description, createdBy:{idMaster,trigram},
  //  image:{fileName}, transformedImage:{fileName}|null, viewerMode,
  //  aspectRatio, legendOverlay, whiteBackground, border,
  //  title:{visible,fontSize}, hiddenAnnotationTemplateIds, baseMaps,
  //  camera2d, camera3d}
  // Point of view ("POV"): a saved framed view of the 2D map or 3D scene.
  // `image` references a db.files row (PNG <= 200 KB). The metadata fields
  // (viewerMode, aspectRatio, baseMaps + active versions, hidden templates,
  // camera2d footprint in baseMap image px / camera3d pose + frameFraction)
  // allow reproducing the same framed view on any screen size. Ordered by
  // fractional `sortIndex`. Soft-deleted via middleware.
  povs: "id,projectId,scopeId,[projectId+scopeId]",
});

db.version(26).stores({
  // {id, projectId, hostAnnotationId, openingAnnotationId,
  //  hostSegmentStartPointId, hostSegmentEndPointId, hostArcControlPointId,
  //  hostDistanceM, carve}
  // Opening relation: links a host wall annotation to an opening annotation
  // glued on one of its segments. The opening center is anchored at a FIXED
  // distance (meters) from the reference vertex hostSegmentStartPointId.
  // `carve` records how the host was carved at commit:
  //   { mode: "CONTOUR", notchPointIds } | { mode: "CUT", cutId } | { mode: "NONE" }
  // Soft-deleted when either annotation is deleted.
  relAnnotationOpenings: "id, projectId, hostAnnotationId, openingAnnotationId",
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
  "portfolioPages",
  "portfolioBaseMapContainers",
  "entityModels",
  "baseMapVersions",
  "layers",
  "relAnnotationSubtractions",
  "relAnnotationMeshCells",
  "relAnnotationOpenings",
  "dimensions3d", // legacy — replaced by COTE annotations
  "meshes3d",
  "povs",
];

// Shared/collaborative tables exempt from the ownership guard: records here can
// be modified and deleted by anyone, not only their creator. Used for resources
// that are meant to be edited collectively (e.g. annotation templates).
const OWNERSHIP_EXEMPT_TABLES = new Set([
  "annotationTemplates",
  // BaseMaps are collaborative resources: anyone can rename, reorder,
  // move or delete them (and their versions), not only their creator.
  "baseMaps",
  "baseMapVersions",
  // POVs are a shared list: anyone can reorder, edit or delete them.
  "povs",
]);

AUDIT_TABLES.forEach((tableName) => {
  db[tableName].hook("creating", function (primKey, obj) {
    obj.createdAt = obj.createdAt || new Date().toISOString();
    obj.createdByUserIdMaster =
      obj.createdByUserIdMaster || getCurrentUserIdMaster();
    obj.updatedAt = obj.updatedAt || new Date().toISOString();
    // System writes (Krto import / remote sync) are not user-driven local edits,
    // so they must not trip the local-change tracker (would falsely mark the scope
    // dirty and fire per-record during bulk imports).
    if (!_skipOwnershipGuard) notifyLocalChange();
  });

  db[tableName].hook("updating", function (modifications, primKey, obj) {
    if (!_skipOwnershipGuard) notifyLocalChange();

    if (_skipOwnershipGuard) {
      // System write (import / sync / authorized cascade): preserve incoming
      // values, no guard and no auto-stamp.
      if (!modifications.updatedAt) {
        return { ...modifications, updatedAt: new Date().toISOString() };
      }
      return modifications;
    }

    const currentUser = getCurrentUserIdMaster();
    if (
      !OWNERSHIP_EXEMPT_TABLES.has(tableName) &&
      !canEditRecord(obj, currentUser)
    ) {
      throw new OwnershipError();
    }

    const extra = {};
    if (!modifications.updatedAt) {
      extra.updatedAt = new Date().toISOString();
    }
    if (modifications.updatedByUserIdMaster === undefined) {
      // Stamp the modifier — also "reserves" a previously free record.
      extra.updatedByUserIdMaster = currentUser;
    }
    return Object.keys(extra).length > 0
      ? { ...modifications, ...extra }
      : modifications;
  });
});

// --- POINT SCOPE STAMP ---
// A point belongs to the scope it was created in. Its listingId is unreliable
// (historically omitted by paste/clone paths) and means nothing — scope
// filtering must read point.scopeId first, and only fall back to
// listing/baseMap heuristics for legacy rows (no migration: old points simply
// lack the field). Stamped centrally so every creation path (draw, cut, paste,
// clone, mesh, auto-annotations, ...) gets it, including future ones. System
// writes (Krto import / remote sync) are skipped so imported rows keep their
// incoming value — loadKrtoZip's transform / remapDexieExportIds already remap
// `scopeId` fields to the target scope.

function getCurrentScopeId() {
  return store.getState()?.scopes?.selectedScopeId ?? null;
}

db.points.hook("creating", function (primKey, obj) {
  if (_skipOwnershipGuard) return;
  if (obj.scopeId === undefined) {
    const scopeId = getCurrentScopeId();
    if (scopeId) obj.scopeId = scopeId;
  }
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
  "portfolioPages",
  "portfolioBaseMapContainers",
  "entityModels",
  "baseMapVersions",
  "layers",
  "relAnnotationSubtractions",
  "relAnnotationMeshCells",
  "relAnnotationOpenings",
  "dimensions3d", // legacy — replaced by COTE annotations
  "meshes3d",
  "povs",
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
      if (
        !_skipOwnershipGuard &&
        !OWNERSHIP_EXEMPT_TABLES.has(tableName) &&
        !canEditRecord(record, deletedByUserIdMaster)
      ) {
        throw new OwnershipError();
      }
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

  if (!_skipOwnershipGuard && !OWNERSHIP_EXEMPT_TABLES.has(tableName)) {
    for (const record of recordsToDelete) {
      if (!canEditRecord(record, deletedByUserIdMaster)) {
        throw new OwnershipError();
      }
    }
  }

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
