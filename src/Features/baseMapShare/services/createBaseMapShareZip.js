import db from "App/db/db";
import sanitizeName from "Features/misc/utils/sanitizeName";
import JSZip from "jszip";

import parseDexieExportBlob from "Features/krtoFile/utils/parseDexieExportBlob";

function walkFileNames(obj, cb, seen = new WeakSet()) {
  if (!obj || typeof obj !== "object") return;
  if (seen.has(obj)) return;
  seen.add(obj);
  if (Array.isArray(obj)) {
    for (const item of obj) walkFileNames(item, cb, seen);
    return;
  }
  if (obj.fileName && (obj.isImage || obj.fileType)) cb(obj.fileName);
  for (const [k, v] of Object.entries(obj)) {
    if (k === "fileArrayBuffer") continue;
    if (v && typeof v === "object") walkFileNames(v, cb, seen);
  }
}

export default async function createBaseMapShareZip({
  baseMapId,
  annotationIds,
  includeAllVersions = false,
}) {
  if (!baseMapId) throw new Error("baseMapId missing");

  const baseMap = await db.baseMaps.get(baseMapId);
  if (!baseMap) throw new Error(`BaseMap ${baseMapId} not found`);

  const allVersions = (
    await db.baseMapVersions.where("baseMapId").equals(baseMapId).toArray()
  ).filter((r) => !r.deletedAt);
  const baseMapVersions = includeAllVersions
    ? allVersions
    : allVersions.filter((v) => v.isActive);
  const baseMapVersionIds = new Set(baseMapVersions.map((v) => v.id));

  const annotations = annotationIds?.length
    ? (
        await db.annotations.where("id").anyOf(annotationIds).toArray()
      ).filter((r) => !r.deletedAt)
    : [];
  const keptAnnotationIds = new Set(annotations.map((a) => a.id));

  const pointIds = new Set();
  for (const a of annotations) {
    for (const p of a.points || []) if (p?.id) pointIds.add(p.id);
    for (const cut of a.cuts || []) {
      for (const p of cut?.points || []) if (p?.id) pointIds.add(p.id);
    }
  }
  const points = pointIds.size
    ? (
        await db.points.where("id").anyOf([...pointIds]).toArray()
      ).filter((r) => !r.deletedAt)
    : [];
  const keptPointIds = new Set(points.map((p) => p.id));

  const templateIds = new Set(
    annotations.map((a) => a.annotationTemplateId).filter(Boolean)
  );
  const annotationTemplates = templateIds.size
    ? (
        await db.annotationTemplates
          .where("id")
          .anyOf([...templateIds])
          .toArray()
      ).filter((r) => !r.deletedAt)
    : [];
  const keptTemplateIds = new Set(annotationTemplates.map((t) => t.id));

  const listingIds = new Set();
  if (baseMap.listingId) listingIds.add(baseMap.listingId);
  for (const a of annotations) if (a.listingId) listingIds.add(a.listingId);
  for (const t of annotationTemplates) if (t.listingId) listingIds.add(t.listingId);

  const listings = listingIds.size
    ? (
        await db.listings.where("id").anyOf([...listingIds]).toArray()
      ).filter((r) => !r.deletedAt)
    : [];
  const keptListingIds = new Set(listings.map((l) => l.id));
  const listingById = Object.fromEntries(listings.map((l) => [l.id, l]));

  const layers = (
    await db.layers.where("baseMapId").equals(baseMapId).toArray()
  ).filter((r) => !r.deletedAt);
  const keptLayerIds = new Set(layers.map((l) => l.id));

  const entityIdsByTable = {};
  for (const a of annotations) {
    const table = a.listingTable || listingById[a.listingId]?.table;
    if (!table || !a.entityId) continue;
    if (!db[table]) continue;
    if (!entityIdsByTable[table]) entityIdsByTable[table] = new Set();
    entityIdsByTable[table].add(a.entityId);
  }

  const allowedFileNames = new Set();
  if (baseMap.image?.fileName) allowedFileNames.add(baseMap.image.fileName);
  for (const v of baseMapVersions) {
    if (v.image?.fileName) allowedFileNames.add(v.image.fileName);
  }

  for (const [table, ids] of Object.entries(entityIdsByTable)) {
    const rows = await db[table].where("id").anyOf([...ids]).toArray();
    for (const row of rows) {
      walkFileNames(row, (fn) => allowedFileNames.add(fn));
    }
  }

  const blob = await db.export({
    filter: (table, value) => {
      if (!value) return false;
      if (table === "baseMaps") return value.id === baseMapId;
      if (table === "baseMapVersions") return baseMapVersionIds.has(value.id);
      if (table === "annotations") return keptAnnotationIds.has(value.id);
      if (table === "points") return keptPointIds.has(value.id);
      if (table === "annotationTemplates") return keptTemplateIds.has(value.id);
      if (table === "listings") return keptListingIds.has(value.id);
      if (table === "layers") return keptLayerIds.has(value.id);
      if (table === "files") return allowedFileNames.has(value.fileName);
      if (entityIdsByTable[table]) return entityIdsByTable[table].has(value.id);
      return false;
    },
  });

  const jsonData = await parseDexieExportBlob(blob);
  const zip = new JSZip();

  const filesTableData = jsonData.data.data.find((t) => t.tableName === "files");
  if (filesTableData?.rows) {
    const imgFolder = zip.folder("images");
    filesTableData.rows.forEach((row) => {
      if (row.fileArrayBuffer && row.fileName) {
        imgFolder.file(row.fileName, row.fileArrayBuffer, { base64: true });
        delete row.fileArrayBuffer;
      }
    });
  }

  zip.file("project_data.json", JSON.stringify(jsonData));

  const baseName = sanitizeName(baseMap.name || "basemap");
  const filename = `basemap_${baseName}.zip`;

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return new File([zipBlob], filename, { type: "application/zip" });
}
