import { nanoid } from "@reduxjs/toolkit";

import resolveTypesonCyclicRefs from "Features/krtoFile/utils/resolveTypesonCyclicRefs";

/**
 * Rewrites every primary key and foreign-key reference in a parsed
 * dexie-export JSON so the data imports as an INDEPENDENT copy: no id
 * collisions under `overwriteValues: true`, and every audited record re-owned
 * by the importing user so the ownership guard (App/db/ownership) lets them
 * edit it.
 *
 * Mutates `jsonData.data.data[].rows` in place. Pure (no DB / store access):
 * the caller resolves the importing user and owns all I/O.
 *
 * Primary keys differ per table: most key on `id`; `files` keys on `fileName`
 * (regenerated, extension preserved); `zonings` keys on `listingId` (remapped
 * via the listings id map). Rows keyed by `path` (syncFiles) carry no `id` and
 * are not remapped here — callers that must avoid collisions should drop them.
 *
 * @param {object} jsonData - parsed dexie export; jsonData.data.data = [{tableName, rows}]
 * @param {object} opts
 * @param {string} opts.importingUserIdMaster - written onto createdByUserIdMaster
 * @param {object} [opts.overrideIds] - fixed id targets, e.g.
 *        { projects: { [oldId]: newProjectId }, scopes: { [oldId]: newScopeId } }
 * @returns {{ idMap: object, fileNameMap: object, newProjectId: (string|null), newScopeId: (string|null) }}
 */
export default function remapDexieExportIds(jsonData, opts) {
  const { importingUserIdMaster, overrideIds = {} } = opts || {};
  const tables = jsonData?.data?.data || [];

  // Simple FK field -> target id-map table (references a known fixed table).
  const SIMPLE_FK = {
    baseMapId: "baseMaps",
    listingId: "listings",
    annotationTemplateId: "annotationTemplates",
    layerId: "layers",
    mapId: "maps",
    portfolioPageId: "portfolioPages",
    zoningId: "listings", // zonings is keyed by listingId
    relListingId: "listings",
    annotationId: "annotations",
    sourceAnnotationId: "annotations",
    targetAnnotationId: "annotations",
    parentAnnotationId: "annotations",
    meshCellAnnotationId: "annotations",
  };

  // 1. Build id maps + file-name map ----------------------------------------
  const idMap = {};
  const fileNameMap = {};

  for (const t of tables) {
    const tableName = t.tableName;
    if (!t.rows) continue;

    if (tableName === "files") {
      for (const row of t.rows) {
        if (row.fileName) {
          const ext = row.fileName.includes(".")
            ? row.fileName.slice(row.fileName.lastIndexOf("."))
            : "";
          fileNameMap[row.fileName] = `${nanoid()}${ext}`;
        }
      }
      continue;
    }

    if (!idMap[tableName]) idMap[tableName] = {};
    for (const row of t.rows) {
      if (!row.id) continue; // zonings (PK listingId) / syncFiles (PK path)
      idMap[tableName][row.id] = overrideIds?.[tableName]?.[row.id] ?? nanoid();
    }
  }

  // Lookups derived from the listings table.
  const listingsTable = tables.find((t) => t.tableName === "listings");
  const listingTableByOldId = {}; // oldListingId -> entity table name
  const listingKeyToTable = {}; // listing.key -> entity table name
  if (listingsTable?.rows) {
    for (const row of listingsTable.rows) {
      if (row.id && row.table) listingTableByOldId[row.id] = row.table;
      if (row.key && row.table) listingKeyToTable[row.key] = row.table;
    }
  }

  const remapId = (table, id) =>
    id && idMap[table]?.[id] ? idMap[table][id] : id;

  // Remap an annotation.points[] / cut.points[] ref: rewrite the point id and
  // DROP any legacy inline x/y (db.points is the source of truth — see
  // docs/annotations/POINTS_STORAGE.md; stale inline values win at read time).
  const remapPointRef = (p) => {
    const ref = { id: remapId("points", p?.id) };
    if (p?.type) ref.type = p.type;
    return ref;
  };

  // 2. Rewrite rows ----------------------------------------------------------
  for (const t of tables) {
    const tableName = t.tableName;
    if (!t.rows) continue;

    for (const row of t.rows) {
      // Materialize Typeson cyclic references ("#" in `$types`) before any
      // rewrite: the point remap below assumes every points[] element is a
      // { id } object and would otherwise turn a "#points.N" ref string into
      // { id: undefined } while leaving the stale "#" marker, crashing the
      // import-time revive with "value.slice is not a function".
      resolveTypesonCyclicRefs(row);

      // Re-own audited records (leave non-audited rows untouched).
      if ("createdByUserIdMaster" in row || "updatedByUserIdMaster" in row) {
        row.createdByUserIdMaster = importingUserIdMaster;
        delete row.updatedByUserIdMaster;
      }

      // Capture OLD refs needed to resolve dynamic entity tables before rewrite.
      const oldListingId = row.listingId;
      const oldRelListingId = row.relListingId;

      // Primary key.
      if (tableName === "files") {
        // fileName rewritten via rewriteFileNamesInObject below.
      } else if (tableName === "zonings") {
        if (row.listingId) row.listingId = remapId("listings", row.listingId);
      } else if (idMap[tableName]?.[row.id]) {
        row.id = idMap[tableName][row.id];
      }

      // projectId / scopeId (generic, through the override-seeded maps).
      if ("projectId" in row)
        row.projectId = remapId("projects", row.projectId);
      if ("scopeId" in row) row.scopeId = remapId("scopes", row.scopeId);

      // Simple FK columns.
      for (const [field, targetTable] of Object.entries(SIMPLE_FK)) {
        if (tableName === "zonings" && field === "listingId") continue; // handled as PK
        if (field in row && row[field]) {
          row[field] = remapId(targetTable, row[field]);
        }
      }

      // Entity-id columns that reference a dynamic entity table.
      if (tableName === "annotations" && row.entityId) {
        const table =
          row.listingTable || listingTableByOldId[oldListingId] || null;
        if (table) row.entityId = remapId(table, row.entityId);
      }
      if (tableName === "markers" && row.targetEntityId) {
        const table = listingTableByOldId[oldListingId] || null;
        if (table) row.targetEntityId = remapId(table, row.targetEntityId);
      }
      if (tableName === "relsZoneEntity") {
        if (row.entityId) {
          const table = listingTableByOldId[oldListingId] || null;
          if (table) row.entityId = remapId(table, row.entityId);
        }
        if (row.relId) {
          const table = listingTableByOldId[oldRelListingId] || null;
          if (table) row.relId = remapId(table, row.relId);
        }
      }
      if (tableName === "relationsEntities") {
        const table = listingTableByOldId[oldListingId] || null;
        if (table) {
          if (row.sourceEntityId)
            row.sourceEntityId = remapId(table, row.sourceEntityId);
          if (row.targetEntityId)
            row.targetEntityId = remapId(table, row.targetEntityId);
        }
      }
      if (tableName === "entitiesProps" && row.targetEntityId) {
        const table = listingKeyToTable[row.targetListingKey] || null;
        if (table) row.targetEntityId = remapId(table, row.targetEntityId);
      }
      if (tableName === "files" && row.entityId) {
        // Probe every id map: files.entityId may reference a basemap or entity.
        for (const mapTable of Object.keys(idMap)) {
          if (idMap[mapTable][row.entityId]) {
            row.entityId = idMap[mapTable][row.entityId];
            break;
          }
        }
      }

      // Mesh cell provenance (nested refs, informational only).
      if (tableName === "meshes3d" && row.sourceInfo) {
        if (row.sourceInfo.annotationId)
          row.sourceInfo.annotationId = remapId(
            "annotations",
            row.sourceInfo.annotationId
          );
        if (row.sourceInfo.baseMapId)
          row.sourceInfo.baseMapId = remapId(
            "baseMaps",
            row.sourceInfo.baseMapId
          );
      }

      // POV view metadata (nested baseMap / version / template refs used to
      // restore the saved view).
      if (tableName === "povs") {
        if (Array.isArray(row.hiddenAnnotationTemplateIds)) {
          row.hiddenAnnotationTemplateIds = row.hiddenAnnotationTemplateIds.map(
            (id) => remapId("annotationTemplates", id)
          );
        }
        if (row.baseMaps) {
          const b = row.baseMaps;
          if (b.mainBaseMapId)
            b.mainBaseMapId = remapId("baseMaps", b.mainBaseMapId);
          if (Array.isArray(b.visibleBaseMapIdsIn3d)) {
            b.visibleBaseMapIdsIn3d = b.visibleBaseMapIdsIn3d.map((id) =>
              remapId("baseMaps", id)
            );
          }
          if (b.activeVersionIdByBaseMapId) {
            b.activeVersionIdByBaseMapId = Object.fromEntries(
              Object.entries(b.activeVersionIdByBaseMapId).map(
                ([baseMapId, versionId]) => [
                  remapId("baseMaps", baseMapId),
                  remapId("baseMapVersions", versionId),
                ]
              )
            );
          }
        }
      }

      // Annotation point refs (points[] and cuts[*].points[]).
      if (tableName === "annotations") {
        if (Array.isArray(row.points)) {
          row.points = row.points.map(remapPointRef);
        }
        if (Array.isArray(row.cuts)) {
          row.cuts = row.cuts.map((cut) => ({
            ...cut,
            points: Array.isArray(cut?.points)
              ? cut.points.map(remapPointRef)
              : cut?.points,
          }));
        }
      }

      // Embedded fileName refs (baseMap.image.fileName, version.image.fileName,
      // entity file blobs) + the files-row own fileName.
      rewriteFileNamesInObject(row, fileNameMap);
    }
  }

  const originalProjectId = Object.keys(overrideIds?.projects || {})[0] || null;
  const originalScopeId = Object.keys(overrideIds?.scopes || {})[0] || null;

  return {
    idMap,
    fileNameMap,
    newProjectId: originalProjectId
      ? overrideIds.projects[originalProjectId]
      : null,
    newScopeId: originalScopeId ? overrideIds.scopes[originalScopeId] : null,
  };
}

// Deep-rewrite every `fileName` string reference found in an object graph.
function rewriteFileNamesInObject(obj, fileNameMap, seen = new WeakSet()) {
  if (!obj || typeof obj !== "object") return;
  if (seen.has(obj)) return;
  seen.add(obj);
  if (Array.isArray(obj)) {
    for (const item of obj) rewriteFileNamesInObject(item, fileNameMap, seen);
    return;
  }
  if (obj.fileName && fileNameMap[obj.fileName]) {
    obj.fileName = fileNameMap[obj.fileName];
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === "fileArrayBuffer") continue;
    if (v && typeof v === "object")
      rewriteFileNamesInObject(v, fileNameMap, seen);
  }
}
