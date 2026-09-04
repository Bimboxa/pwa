import Dexie from "dexie";
import "dexie-export-import";
import { nanoid } from "@reduxjs/toolkit";

import store from "App/store";
import { UNDO_TABLES, _skipUndo, pushUndo } from "./undoManager";
import {
  canEditRecord,
  getEffectiveOwner,
  isScopeEditor,
  normalizeOwnerId,
  OwnershipError,
  ReadOnlyScopeError,
} from "./ownership";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";
import getUserTrigram from "Features/auth/utils/getUserTrigram";
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
  //  image:{fileName}, rawImage:{fileName}|null,
  //  transformedImage:{fileName}|null, viewerMode,
  //  aspectRatio, legendOverlay, whiteBackground, border,
  //  title:{visible,fontSize}, showLogo, viewCreatedAt,
  //  hiddenAnnotationTemplateIds, visibleAnnotationTemplateIds, baseMaps,
  //  camera2d, camera3d}
  // Point of view ("POV"): a saved framed view of the 2D map or 3D scene.
  // `image` references a db.files row (PNG <= 200 KB). `rawImage` is the
  // optional full-resolution capture (written by the capture tool's "Point de
  // vue" export mode, used for HD downloads); it is deliberately EXCLUDED from
  // the Krto/scope export — see createKrtoZip — and regenerated on demand from
  // the POV module. The metadata fields
  // (viewerMode, aspectRatio, baseMaps + active versions + visibleBaseMapIds,
  // visible/hidden templates, camera2d footprint in baseMap image px /
  // camera3d pose + frameFraction) allow reproducing the same framed view on
  // any screen size. Ordered by fractional `sortIndex`. Soft-deleted via
  // middleware.
  // The view is a FROZEN snapshot: `viewCreatedAt` (regenerated on every
  // capture, incl. "update the view") gates the annotations at restore time
  // (povSlice.viewFreeze) and `visibleAnnotationTemplateIds` is a whitelist —
  // templates created after the capture are hidden too.
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

db.version(27).stores({
  // {id, listingId (ZONING listing), parentId|null, label, color,
  //  sortIndex (fractional index among siblings), scopeId, projectId}
  // Flat zone rows (zonings v2) — one row per zone of a ZONING listing tree.
  // The legacy `zonings` blob table (one row per listing) stays untouched.
  zones: "id,listingId,projectId,scopeId,parentId",
  // {id, projectId, annotationId, zoneId, listingId (zoning listingId), scopeId}
  // Links ANY annotation to a zone. Invariant: at most ONE live rel per
  // (annotationId, listingId) — enforced by addZoneToAnnotationService
  // (associating to another zone of the same zoning replaces the old rel).
  relsZoneAnnotation: "id,projectId,annotationId,zoneId,listingId",
});

db.version(28).stores({
  // {userIdMaster (string), trigram, firstName, lastName, updatedAt}
  // idMaster ⇔ trigram directory. The current user is upserted before every
  // Krto zip export (createKrtoZip) and the whole table ships in the zip, so
  // readers can resolve the private-scope owner label (bottom-bar banner)
  // offline from scope.createdByUserIdMaster.
  // NOT audited / soft-deleted / undoable on purpose: plain reference rows,
  // writable even while a foreign private scope is selected, and the PK is
  // `userIdMaster` (not `id`) so remapDexieExportIds leaves rows untouched
  // on the duplicate-import path.
  usersDirectory: "userIdMaster",
});

db.version(29).stores({
  // {id, projectId, name (file name with extension), fileName (db.files key of
  //  the main file), fileSize, fileMime, fileType ("PDF"|"IMAGE"|"DWG"|...),
  //  thumbnail (base64 dataURL | null), createdBy: {idMaster, trigram}}
  // Project resource: a file (PDF, DWG, image…) attached to the PROJECT and
  // managed from the right-panel "Ressources" tool. The main file lives in
  // db.files WITHOUT listingId, so the Krto files filter excludes it from the
  // scope export by construction (like POV rawImage) — only the metadata row
  // (inline thumbnail included) ships in the zip; after an import the user
  // re-attaches the file locally from the resource detail panel.
  resources: "id,projectId",
});

db.version(30).stores({
  // {id, projectId, listingId (PHOTO album listing, project-level, NO
  //  scopeId — shared across scopes like baseMaps listings), baseMapId,
  //  name, point: {x,y}|null (normalized [0..1] vs baseMap.image.imageSize,
  //  INLINE on purpose: a db.points row would be dropped by the Krto points
  //  filter — collectReferencedPointIds only scans annotations — and purged
  //  as an orphan), directionDeg (camera heading, atan2(-dy,dx) in the
  //  y-down px frame, same convention as REVOLUTION_AXIS), fovDeg, radiusM,
  //  image: {fileName, imageSize, thumbnail (base64 dataURL), fileUpdatedAt},
  //  createdBy: {idMaster, trigram}}
  // Photo localized on a base map as a camera pose (point + view cone).
  // The full-size image lives in db.files WITH the album listingId so it
  // ships in the Krto zip; the inline thumbnail feeds the grid and the map
  // hover tooltip. point == null → uploaded but not localized yet.
  // Rendered in the 2D editor via useAnnotationsV2 as read-only
  // pseudo-annotations of type "PHOTO" (id prefixed "photo::").
  photos: "id,projectId,listingId,baseMapId",
});

db.version(31).stores({
  // {id, projectId, scopeId, listingId (source polygon's isForBaseMaps listing),
  //  baseMapId (the PHOTO baseMap), annotationId (source POLYGON on the photo),
  //  name, orientation ("HORIZONTAL"|"VERTICAL" — real-world plane orientation),
  //  calibrationInputs: null | { uSegments, vSegments, photoTargets, planTargets,
  //    planBaseMapId, refColor, refHeight, focalPxOverride, knownCote } (all
  //    coords normalized 0..1 — source of truth, re-editable),
  //  calibration: null | { ok, errorCode?, H:[9], Hinv:[9] (normalized-photo in,
  //    meters out), imageSize (bake-time aspect guard), pose {origin,uDir,vDir,
  //    normal}, horizonLine, diagnostics, computedAt } (cached output of
  //    computePhotoPlanCalibration — cheap to recompute from inputs)}
  // One row per planar region ("plan photo") of a photo baseMap.
  photoPlans: "id,projectId,baseMapId,annotationId,listingId",
  // Version-collision healing: the photoPlans branch temporarily claimed
  // version 29 for this table while main used 29/30 for resources/photos.
  // A local db that upgraded through THAT v29 skipped main's `resources`
  // declaration — redeclaring it here (same schema, no-op when present)
  // converges every upgrade path.
  resources: "id,projectId",
});

db.version(32).stores({
  // {id (== scopeId at creation — deterministic so two devices upsert the
  //  SAME row and the Krto merge newest-wins applies per-row; a duplicated
  //  scope gets a fresh id, reads always go through the scopeId index),
  //  scopeId, projectId,
  //  disabledModuleKeys: [moduleKey] (hidden from the left band),
  //  disabledToolKeys: [toolKey] (root-disabled: gone in every module),
  //  disabledToolKeysByModule: {moduleKey: [toolKey]}}
  // One row per scope by convention. Collaborative configuration of the
  // left-band modules and right-band tools: AUDITED (timestamps feed the
  // Krto merge) and OWNERSHIP-EXEMPT; the app writes it exclusively through
  // withSystemWrite (useScopeConfigActions) so ANY user — including a
  // visitor on a foreign private scope — can toggle it. NOT soft-deleted.
  scopeConfigs: "id,scopeId,projectId",
});

db.version(33).stores({
  // {id, listingId (BUSINESS_OBJECT listing), parentId|null, label, color,
  //  description?, sortIndex (fractional index among siblings),
  //  unit ("U"|"L"|"S" — u / ml / m², drives the quantity rollup rule),
  //  scopeId, projectId}
  // Business objects ("Ouvrages") of a listing, organized as a tree.
  businessObjects: "id,listingId,projectId,scopeId,parentId",
  // {id, projectId, scopeId, annotationId, businessObjectId,
  //  listingId (the business-objects listingId),
  //  isMain?, baseMapId? — MAIN annotation of a "located" object on that
  //  base map (drawn by "Localiser" with one of the listing's OWN
  //  annotationTemplates, flagged isBusinessObjectAnnotation); its
  //  displayed label = the object's label.}
  // N-N: several annotations per object AND several objects per annotation.
  // Invariants (service-enforced): at most ONE live rel per
  // (annotationId, businessObjectId) pair; at most one live isMain rel per
  // (businessObjectId, baseMapId) and per annotationId. isMain is a boolean
  // (not indexable) — filtered in memory after an indexed lookup.
  relsBusinessObjectAnnotation:
    "id,projectId,annotationId,businessObjectId,listingId",
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
  "zones",
  "relsZoneAnnotation",
  "resources",
  "photos",
  "photoPlans",
  "scopeConfigs",
  "businessObjects",
  "relsBusinessObjectAnnotation",
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
  // Zones are shared structure (anyone renames/reorders/recolors), and the
  // one-zone-per-zoning replace rule must be able to soft-delete rels
  // created by other users.
  "zones",
  "relsZoneAnnotation",
  // Photos are scope-shared collaborative rows (project-level albums),
  // editable by anyone like baseMaps and povs.
  "photos",
  // PhotoPlans are shared calibration resources: anyone can rename, re-orient
  // or recalibrate a plan photo, not only its creator.
  "photoPlans",
  // Module/tool activation is shared configuration: anyone edits it, not
  // only the scope creator.
  "scopeConfigs",
  // Business objects are shared structure (anyone renames/reorders/links),
  // and unlinking must be able to soft-delete rels created by other users.
  "businessObjects",
  "relsBusinessObjectAnnotation",
]);

// --- READ-ONLY SCOPE GUARD ---
// A scope with `isPublic !== true` is read-only for everyone but its creator:
// ALL writes to scope-content tables are blocked while such a scope is
// selected — including creates, which the per-record ownership guard cannot
// catch (a visitor's own new records would pass it). The ownership exemption
// (collaborative tables) does NOT apply here: collaboration is only allowed
// inside public scopes. System writes (`withSystemWrite`: duplicate, Krto
// import, remote sync) bypass the guard.

// Scope-content tables = AUDIT_TABLES minus projects/scopes (the scope record
// itself stays per-record guarded so its creator can always edit it), plus
// relAnnotationMappingCategory (not audited, but scope content).
const READ_ONLY_BLOCKED_TABLES = new Set([
  ...AUDIT_TABLES.filter((t) => t !== "projects" && t !== "scopes"),
  "relAnnotationMappingCategory",
]);

// Returns the selected scope's id when it is read-only for the current user,
// else null. Synchronous read of the redux store (scopes are live-synced into
// state.scopes.scopesById by dexieSyncService). A freshly created scope not
// yet synced resolves to null → writable → correct (creator's own scope).
function getActiveReadOnlyScopeId() {
  const state = store.getState();
  const scopeId = state?.scopes?.selectedScopeId;
  const scope = scopeId ? state?.scopes?.scopesById?.[scopeId] : null;
  if (!scope || scope.isPublic === true) return null;
  const owner = getEffectiveOwner(scope);
  if (owner === null) return null; // legacy ownerless scope: free for all
  const currentUser = normalizeOwnerId(getUserIdMaster(state.auth.userProfile));
  if (owner === currentUser) return null;
  // Granted editors (scope.editorsTrigrams) write like the creator does.
  if (isScopeEditor(scope, getUserTrigram(state.auth.userProfile))) return null;
  return scopeId;
}

// Editor bypass: the current user was granted edit rights on the selected
// scope (scope.editorsTrigrams). Applies ONLY to scope-content tables
// (READ_ONLY_BLOCKED_TABLES): the scopes/projects records themselves stay
// per-record guarded — editors cannot rename the scope, toggle isPublic or
// edit editorsTrigrams. Mirrors assertNotReadOnlyScope's cross-scope
// exception: a record explicitly targeting ANOTHER scope is not covered.
// Fail-closed: before dexieSyncService fills scopesById, this returns false.
function isEditorBypassAllowed(tableName, record) {
  if (!READ_ONLY_BLOCKED_TABLES.has(tableName)) return false;
  const state = store.getState();
  const scopeId = state?.scopes?.selectedScopeId;
  if (!scopeId) return false;
  if (record?.scopeId && record.scopeId !== scopeId) return false;
  const scope = state?.scopes?.scopesById?.[scopeId];
  return isScopeEditor(scope, getUserTrigram(state?.auth?.userProfile));
}

function assertNotReadOnlyScope(tableName, obj) {
  if (_skipOwnershipGuard) return;
  if (!READ_ONLY_BLOCKED_TABLES.has(tableName)) return;
  const readOnlyScopeId = getActiveReadOnlyScopeId();
  if (!readOnlyScopeId) return;
  // Content explicitly targeting ANOTHER scope stays allowed (e.g. new-scope
  // creation while the read-only scope is still selected).
  if (obj?.scopeId && obj.scopeId !== readOnlyScopeId) return;
  throw new ReadOnlyScopeError();
}

AUDIT_TABLES.forEach((tableName) => {
  db[tableName].hook("creating", function (primKey, obj) {
    // Before notifyLocalChange so a read-only scope is never marked dirty.
    assertNotReadOnlyScope(tableName, obj);
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
    assertNotReadOnlyScope(tableName, obj);
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
      !canEditRecord(obj, currentUser) &&
      !isEditorBypassAllowed(tableName, obj)
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

// relAnnotationMappingCategory is scope content but not in AUDIT_TABLES (no
// audit stamping wanted) — give it dedicated read-only guard hooks.
db.relAnnotationMappingCategory.hook("creating", function (primKey, obj) {
  assertNotReadOnlyScope("relAnnotationMappingCategory", obj);
});
db.relAnnotationMappingCategory.hook(
  "updating",
  function (modifications, primKey, obj) {
    assertNotReadOnlyScope("relAnnotationMappingCategory", obj);
  }
);
db.relAnnotationMappingCategory.hook("deleting", function (primKey, obj) {
  assertNotReadOnlyScope("relAnnotationMappingCategory", obj);
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
  "zones",
  "relsZoneAnnotation",
  "resources",
  "photos",
  "photoPlans",
  "businessObjects",
  "relsBusinessObjectAnnotation",
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
      assertNotReadOnlyScope(tableName, record);
      if (
        !_skipOwnershipGuard &&
        !OWNERSHIP_EXEMPT_TABLES.has(tableName) &&
        !canEditRecord(record, deletedByUserIdMaster) &&
        !isEditorBypassAllowed(tableName, record)
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

  for (const record of recordsToDelete) {
    assertNotReadOnlyScope(tableName, record);
  }

  if (!_skipOwnershipGuard && !OWNERSHIP_EXEMPT_TABLES.has(tableName)) {
    for (const record of recordsToDelete) {
      if (
        !canEditRecord(record, deletedByUserIdMaster) &&
        !isEditorBypassAllowed(tableName, record)
      ) {
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
