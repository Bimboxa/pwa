import { nanoid } from "@reduxjs/toolkit";
import JSZip from "jszip";

import db, { withSystemWrite } from "App/db/db";
import store from "App/store";

import getUserIdMaster from "Features/auth/utils/getUserIdMaster";
import { stripTrailingCommas } from "Features/krtoFile/utils/parseDexieExportBlob";

// Resolve the importing user's master id, normalized to a string like the
// ownership layer expects (App/db/ownership.normalizeOwnerId).
function getImportingUserIdMaster() {
  const raw = getUserIdMaster(store.getState()?.auth?.userProfile);
  return raw != null ? String(raw) : "anonymous";
}

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

function isBaseMapListing(row) {
  return row?.table === "baseMaps" || row?.entityModel?.type === "BASE_MAP";
}

export default async function loadBaseMapShareZip(
  file,
  { projectId, scopeId, baseMapsListingId }
) {
  if (!file) throw new Error("Fichier invalide");
  if (!projectId) throw new Error("projectId missing");

  const zip = await JSZip.loadAsync(file);

  const jsonFile = Object.values(zip.files).find((f) =>
    f.name.endsWith(".json")
  );
  if (!jsonFile) throw new Error("JSON introuvable dans le ZIP");
  const jsonContent = await jsonFile.async("text");
  let jsonData;
  try {
    jsonData = JSON.parse(jsonContent);
  } catch {
    jsonData = JSON.parse(stripTrailingCommas(jsonContent));
  }

  const imageEntries = Object.values(zip.files).filter(
    (f) => !f.dir && f.name.startsWith("images/")
  );
  const imageBuffers = new Map();
  await Promise.all(
    imageEntries.map(async (entry) => {
      const fileName = entry.name.slice("images/".length);
      const arrayBuffer = await entry.async("arraybuffer");
      imageBuffers.set(fileName, arrayBuffer);
    })
  );

  const tables = jsonData.data?.data || [];
  const listingsTable = tables.find((t) => t.tableName === "listings");

  // Resolve the scope's current base-map listing so imported base maps are
  // added to it instead of spawning a duplicate "Fonds de plan" listing.
  // Falls back to the project's existing base-map listing (preferring the
  // canonical `mapsGeneric`), and only to a new listing if none exists.
  let targetBaseMapListingId = baseMapsListingId || null;
  if (!targetBaseMapListingId) {
    const projectListings = (
      await db.listings.where("projectId").equals(projectId).toArray()
    ).filter((l) => !l.deletedAt && isBaseMapListing(l));
    targetBaseMapListingId =
      projectListings.find((l) => l.key === "mapsGeneric")?.id ??
      projectListings[0]?.id ??
      null;
  }
  // Old ids of the imported base-map listings (to merge into the target).
  const importedBaseMapListingIds = new Set(
    (listingsTable?.rows ?? []).filter(isBaseMapListing).map((r) => r.id)
  );

  // 1. Build id maps
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
    } else {
      // Fixed tables + any other table (dynamic entity tables)
      if (!idMap[tableName]) idMap[tableName] = {};
      for (const row of t.rows) {
        if (!row.id) continue;
        if (
          tableName === "listings" &&
          targetBaseMapListingId &&
          importedBaseMapListingIds.has(row.id)
        ) {
          // Redirect references to the scope's existing base-map listing.
          idMap.listings[row.id] = targetBaseMapListingId;
        } else {
          idMap[tableName][row.id] = nanoid();
        }
      }
    }
  }

  // Drop the imported base-map listing rows: we merge into the existing
  // listing rather than overwriting it (keep its name/color/order).
  if (targetBaseMapListingId && listingsTable?.rows) {
    listingsTable.rows = listingsTable.rows.filter(
      (row) => !importedBaseMapListingIds.has(row.id)
    );
  }

  // Build listing.table lookup from the listings table (old id -> table name)
  const listingTableByOldId = {};
  if (listingsTable?.rows) {
    for (const row of listingsTable.rows) {
      if (row.id && row.table) listingTableByOldId[row.id] = row.table;
    }
  }

  // 2. Rewrite rows in place
  const newImageBuffers = new Map();

  // Re-own every imported record to the importing user. The export carries the
  // original author's `createdByUserIdMaster`, which would lock the records
  // behind the ownership guard (App/db/ownership) and prevent the importer from
  // editing them. Stamping the importer as the creator makes the imported data
  // editable afterwards.
  const importingUserIdMaster = getImportingUserIdMaster();

  for (const t of tables) {
    const tableName = t.tableName;
    if (!t.rows) continue;

    for (const row of t.rows) {
      // Re-stamp ownership to the importing user (only on records that already
      // carry ownership fields, i.e. audited tables — leave the rest untouched).
      if ("createdByUserIdMaster" in row || "updatedByUserIdMaster" in row) {
        row.createdByUserIdMaster = importingUserIdMaster;
        delete row.updatedByUserIdMaster;
      }

      // Resolve entityId target table from OLD refs BEFORE we rewrite them
      let entityTargetTable = null;
      if (tableName === "annotations" && row.entityId) {
        entityTargetTable =
          row.listingTable || listingTableByOldId[row.listingId] || null;
      }

      // Rewrite top-level id
      if (tableName !== "files" && idMap[tableName]?.[row.id]) {
        row.id = idMap[tableName][row.id];
      }

      // projectId / scopeId
      if ("projectId" in row) row.projectId = projectId;
      if ("scopeId" in row && scopeId) row.scopeId = scopeId;

      // baseMapId
      if (
        "baseMapId" in row &&
        row.baseMapId &&
        idMap.baseMaps?.[row.baseMapId]
      ) {
        row.baseMapId = idMap.baseMaps[row.baseMapId];
      }

      // listingId
      if (
        "listingId" in row &&
        row.listingId &&
        idMap.listings?.[row.listingId]
      ) {
        row.listingId = idMap.listings[row.listingId];
      }

      // annotationTemplateId
      if (
        "annotationTemplateId" in row &&
        row.annotationTemplateId &&
        idMap.annotationTemplates?.[row.annotationTemplateId]
      ) {
        row.annotationTemplateId =
          idMap.annotationTemplates[row.annotationTemplateId];
      }

      // layerId
      if ("layerId" in row && row.layerId && idMap.layers?.[row.layerId]) {
        row.layerId = idMap.layers[row.layerId];
      }

      // entityId rewrites
      if (tableName === "annotations" && row.entityId) {
        if (entityTargetTable && idMap[entityTargetTable]?.[row.entityId]) {
          row.entityId = idMap[entityTargetTable][row.entityId];
        }
      }
      if (tableName === "files" && row.entityId) {
        // files.entityId may reference a basemap or a listed entity; probe id maps
        for (const mapTable of Object.keys(idMap)) {
          if (idMap[mapTable][row.entityId]) {
            row.entityId = idMap[mapTable][row.entityId];
            break;
          }
        }
      }

      // annotation.points[] and annotation.cuts[*].points[]: remap point-ID refs
      // and drop any legacy inline x/y (db.points is the source of truth, per
      // docs/annotations/POINTS_STORAGE.md).
      if (tableName === "annotations") {
        const remapPointRef = (p) => {
          const newId =
            p?.id && idMap.points?.[p.id] ? idMap.points[p.id] : p?.id;
          const ref = { id: newId };
          if (p?.type) ref.type = p.type;
          return ref;
        };
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

      // rewrite embedded fileName references
      rewriteFileNamesInObject(row, fileNameMap);

      // for files table, also rewrite the row's own fileName
      if (tableName === "files" && row.fileName && fileNameMap[row.fileName]) {
        row.fileName = fileNameMap[row.fileName];
      }
    }
  }

  // Rebuild image buffer map keyed by new fileName
  for (const [oldName, arrayBuffer] of imageBuffers.entries()) {
    const newName = fileNameMap[oldName] || oldName;
    newImageBuffers.set(newName, arrayBuffer);
  }

  const newBaseMapId = idMap.baseMaps
    ? Object.values(idMap.baseMaps)[0] || null
    : null;

  // 3. Import via db.import
  const jsonBlob = new Blob([JSON.stringify(jsonData)], {
    type: "application/json",
  });

  // System write: import overwrites/creates records owned by other users.
  await withSystemWrite(() =>
    db.import(jsonBlob, {
      overwriteValues: true,
      acceptVersionDiff: true,
      acceptMissingTables: true,
      chunkSizeBytes: 15 * 1024 * 1024,
      noTransaction: false,
      transform: (table, value) => {
        if (table === "files" && value.fileName) {
          const arrayBuffer = newImageBuffers.get(value.fileName);
          if (arrayBuffer) {
            value.fileArrayBuffer = arrayBuffer;
          }
        }
        return { value };
      },
      progressCallback: (progress) => {
        console.log(
          `BaseMapShare import: ${Math.round(
            (progress.completedRows / progress.totalRows) * 100
          )}%`
        );
        return true;
      },
    })
  );

  return { baseMapId: newBaseMapId };
}
