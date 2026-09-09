import db from "App/db/db";
import JSZip from "jszip";

import parseDexieExportBlob from "Features/krtoFile/utils/parseDexieExportBlob";
import collectFileNamesInObject from "Features/krtoFile/utils/collectFileNamesInObject";
import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";
import upsertCurrentUserInDirectory from "Features/usersDirectory/services/upsertCurrentUserInDirectory";
import {
  PROJECT_EXPORT_KIND,
  PROJECT_EXPORT_FORMAT_VERSION,
  PROJECT_EXPORT_MANIFEST_FILE,
  PROJECT_EXPORT_DATA_FILE,
  PROJECT_EXPORT_IMAGES_DIR,
  buildProjectExportFileName,
} from "../utils/projectExportFormat";

// Full debug dump of ONE project: every scope and every Dexie row reachable
// from the projectId — tombstones (deletedAt), orphan points and corrupted
// rows included — plus every binary (db.files.fileArrayBuffer, POV raw
// images and resource main files included). NO cleaning, unlike
// createKrtoZip: the purpose is to reproduce the local state elsewhere.
//
// Perimeter mirrors deleteProjectLocalDataService (the authoritative "all
// rows of a project" cascade), widened to unions (projectId ∪ scopeId ∪
// listingId ∪ referenced ids) so rows missing one of the fields still ship.
// Global tables stay out (same exclusions as the wipe): orgaData,
// projectFiles, baseMapTransforms. usersDirectory ships whole (tiny), like in
// Krto zips, so readers can resolve owner trigrams offline.
//
// Binaries never go through the JSON: `db.export` gets a transform that
// strips `fileArrayBuffer` from `files` rows (metadata only), then each
// buffer is read back one at a time from db.files and written to `images/`
// as a raw ArrayBuffer. This avoids the base64 → string → decode round trip
// that would blow the tab memory on a whole project.

// Tables reached by the projectId index in deleteProjectLocalDataService
// (minus projects / files, handled explicitly below).
const PROJECT_TABLES = new Set([
  "scopes",
  "listings",
  "baseMaps",
  "baseMapVersions",
  "blueprints",
  "annotationTemplates",
  "annotations",
  "resources",
  "entities",
  "maps",
  "materials",
  "zones",
  "relsZoneAnnotation",
  "relsZoneEntity",
  "businessObjects",
  "relsBusinessObjectAnnotation",
  "globalLayers",
  "workPackages",
  "relsWorkPackageAnnotation",
  "plannings",
  "planningResources",
  "planningSlots",
  "layers",
  "povs",
  "meshes3d",
  "dimensions3d",
  "photos",
  "photoPlans",
  "entityModels",
  "relAnnotationMappingCategory",
  "relAnnotationSubtractions",
  "relAnnotationMeshCells",
  "relAnnotationOpenings",
  "portfolioPages",
  "portfolioBaseMapContainers",
  "scopeConfigs",
]);

const LISTING_ONLY_TABLES = new Set([
  "zonings",
  "legends",
  "relationsEntities",
  "reports",
]);

export default async function createProjectExportZip(projectId) {
  if (!projectId)
    throw new Error("createProjectExportZip: projectId is required");

  const project = await db.projects.get(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  // Record the exporter's idMaster ⇔ trigram before the export (the whole
  // usersDirectory ships in the zip).
  const currentUser = await upsertCurrentUserInDirectory();

  // 1. Pre-collect the id sets needed to reach tables without a projectId
  // index (same resolution pass as deleteProjectLocalDataService).
  const scopes = await db.scopes.where("projectId").equals(projectId).toArray();
  const scopeIds = new Set(scopes.map((s) => s.id));

  const listings = await db.listings
    .where("projectId")
    .equals(projectId)
    .toArray();
  const listingIds = new Set(listings.map((l) => l.id));
  const listingKeys = new Set(listings.map((l) => l.key).filter(Boolean));
  const listingIdList = [...listingIds];

  const mapIds = new Set(
    await db.maps.where("projectId").equals(projectId).primaryKeys()
  );
  if (listingIdList.length > 0) {
    for (const id of await db.maps
      .where("listingId")
      .anyOf(listingIdList)
      .primaryKeys()) {
      mapIds.add(id);
    }
  }

  const baseMapIds = new Set(
    await db.baseMaps.where("projectId").equals(projectId).primaryKeys()
  );

  const resources = await db.resources
    .where("projectId")
    .equals(projectId)
    .toArray();
  const resourceFileNames = new Set(
    resources.map((r) => r.fileName).filter(Boolean)
  );

  // ALL annotations, tombstones included — every referenced point ships,
  // whatever its own projectId / listingId / deletedAt state.
  const annotations = await db.annotations
    .where("projectId")
    .equals(projectId)
    .toArray();
  const referencedPointIds = collectReferencedPointIds(annotations);

  // 2. Metadata export (binaries stripped, see header).
  const blob = await db.export({
    filter: (table, value) => {
      if (!value) return false;

      if (table === "projects") return value.id === projectId;
      if (table === "usersDirectory") return true;
      if (table === "syncFiles") return scopeIds.has(value.scopeId);

      if (table === "baseMapViews") {
        return (
          value.projectId === projectId ||
          scopeIds.has(value.scopeId) ||
          baseMapIds.has(value.baseMapId)
        );
      }
      if (table === "markers") {
        return mapIds.has(value.mapId) || listingIds.has(value.listingId);
      }
      if (table === "entitiesProps") {
        return (
          listingKeys.has(value.listingKey) ||
          listingKeys.has(value.targetListingKey)
        );
      }
      if (LISTING_ONLY_TABLES.has(table)) {
        return listingIds.has(value.listingId);
      }
      if (table === "points") {
        return (
          value.projectId === projectId ||
          scopeIds.has(value.scopeId) ||
          listingIds.has(value.listingId) ||
          referencedPointIds.has(value.id)
        );
      }
      if (table === "files") {
        return (
          value.projectId === projectId ||
          listingIds.has(value.listingId) ||
          resourceFileNames.has(value.fileName)
        );
      }
      if (PROJECT_TABLES.has(table)) {
        return (
          value.projectId === projectId ||
          scopeIds.has(value.scopeId) ||
          listingIds.has(value.listingId)
        );
      }

      // Global tables: orgaData, projectFiles, baseMapTransforms.
      return false;
    },
    transform: (table, value) => {
      if (table === "files" && value && "fileArrayBuffer" in value) {
        // Destructure rather than assigning undefined: typeson would encode
        // an explicit undefined and the row would come back with the key.
        // eslint-disable-next-line no-unused-vars
        const { fileArrayBuffer, ...meta } = value;
        return { value: meta };
      }
      return { value };
    },
  });

  // parseDexieExportBlob works around the trailing-comma bug of
  // dexie-export-import 4.1.4 on filtered exports.
  const jsonData = await parseDexieExportBlob(blob);
  const tables = jsonData.data.data;

  let filesTable = tables.find((t) => t.tableName === "files");
  if (!filesTable) {
    filesTable = { tableName: "files", inbound: true, rows: [] };
    tables.push(filesTable);
  }
  if (!Array.isArray(filesTable.rows)) filesTable.rows = [];

  // 3. Legacy completeness: a fileName referenced by an exported row whose
  // db.files row carries neither projectId nor listingId was not selected
  // above — append its metadata row so its binary ships too.
  const referencedFileNames = new Set();
  for (const t of tables) {
    for (const row of t.rows ?? []) {
      collectFileNamesInObject(row, referencedFileNames);
    }
  }
  const knownFileNames = new Set(filesTable.rows.map((r) => r?.fileName));
  for (const fileName of referencedFileNames) {
    if (knownFileNames.has(fileName)) continue;
    const fileRow = await db.files.get(fileName);
    if (!fileRow) continue;
    // eslint-disable-next-line no-unused-vars
    const { fileArrayBuffer, ...meta } = fileRow;
    filesTable.rows.push(meta);
    knownFileNames.add(fileName);
  }

  // 4. Binaries: one buffer at a time, raw ArrayBuffer into images/.
  const zip = new JSZip();
  const imgFolder = zip.folder(PROJECT_EXPORT_IMAGES_DIR.replace(/\/$/, ""));
  const filesWithoutBinary = [];
  let filesWithBinary = 0;
  for (const row of filesTable.rows) {
    const fileName = row?.fileName;
    if (!fileName) continue;
    const full = await db.files.get(fileName);
    const buffer = full?.fileArrayBuffer;
    if (buffer) {
      // PNG / JPG / PDF are already compressed: store, do not deflate.
      imgFolder.file(fileName, buffer, { compression: "STORE" });
      filesWithBinary += 1;
    } else {
      filesWithoutBinary.push(fileName);
    }
  }

  // 5. Manifest + JSON.
  const rowCounts = {};
  for (const t of tables) rowCounts[t.tableName] = t.rows?.length ?? 0;

  const manifest = {
    kind: PROJECT_EXPORT_KIND,
    formatVersion: PROJECT_EXPORT_FORMAT_VERSION,
    projectId,
    projectName: project.name ?? null,
    clientRef: project.clientRef ?? null,
    idMaster: project.idMaster ?? null,
    scopeIds: [...scopeIds],
    dbVersion: db.verno,
    exportedAt: new Date().toISOString(),
    exportedByUserIdMaster: currentUser?.userIdMaster ?? null,
    rowCounts,
    filesWithBinary,
    filesWithoutBinary,
  };

  zip.file(PROJECT_EXPORT_DATA_FILE, JSON.stringify(jsonData));
  zip.file(PROJECT_EXPORT_MANIFEST_FILE, JSON.stringify(manifest, null, 2));

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    streamFiles: true,
  });

  const fileName = buildProjectExportFileName({
    projectName: project.name,
    clientRef: project.clientRef,
  });

  console.log(
    `[projects] export zip for project ${projectId}: ${filesWithBinary} binaries, ${(zipBlob.size / 1024 / 1024).toFixed(1)} MB`
  );

  return new File([zipBlob], fileName, { type: "application/zip" });
}
