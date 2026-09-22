import db from "App/db/db";

// PDF pages kept as base map sources (resources with a content `sourceKey`)
// are deduped ACROSS imports: when a live local resource already has the
// incoming sourceKey, the incoming row (and its file row) is dropped and the
// base maps referencing it are re-pointed to the local resource, so the
// RESOURCES panel does not fill with identical pages. Mutates jsonData.
export default async function dedupImportedResourcesBySourceKey(jsonData) {
  const tables = jsonData?.data?.data ?? [];
  const resourcesTable = tables.find((t) => t.tableName === "resources");
  const rows = resourcesTable?.rows?.filter((r) => r?.sourceKey) ?? [];
  if (rows.length === 0) return;

  const keys = [...new Set(rows.map((r) => r.sourceKey))];
  const localRows = (
    await db.resources.where("sourceKey").anyOf(keys).toArray()
  ).filter((r) => !r.deletedAt && r.fileName);
  if (localRows.length === 0) return;

  // Prefer a local row whose file is present.
  const localByKey = new Map();
  for (const r of localRows) {
    const fileRecord = await db.files.get(r.fileName);
    const hasFile = Boolean(fileRecord?.fileArrayBuffer);
    const current = localByKey.get(r.sourceKey);
    if (!current || (hasFile && !current.hasFile)) {
      localByKey.set(r.sourceKey, { row: r, hasFile });
    }
  }

  const resourceIdMap = {}; // incoming id -> local id
  const droppedFileNames = new Set();
  resourcesTable.rows = resourcesTable.rows.filter((r) => {
    const local = r?.sourceKey ? localByKey.get(r.sourceKey) : null;
    if (!local || local.row.id === r.id) return true;
    resourceIdMap[r.id] = local.row.id;
    if (r.fileName && r.fileName !== local.row.fileName) {
      droppedFileNames.add(r.fileName);
    }
    return false;
  });
  if (Object.keys(resourceIdMap).length === 0) return;

  const filesTable = tables.find((t) => t.tableName === "files");
  if (filesTable?.rows) {
    filesTable.rows = filesTable.rows.filter(
      (f) => !droppedFileNames.has(f?.fileName)
    );
  }

  const baseMapsTable = tables.find((t) => t.tableName === "baseMaps");
  for (const row of baseMapsTable?.rows ?? []) {
    const rid = row?.createdFrom?.resourceId;
    if (rid && resourceIdMap[rid]) {
      row.createdFrom.resourceId = resourceIdMap[rid];
    }
  }
  const pagesTable = tables.find((t) => t.tableName === "portfolioPages");
  for (const row of pagesTable?.rows ?? []) {
    const rid = row?.folio?.resourceId;
    if (rid && resourceIdMap[rid]) row.folio.resourceId = resourceIdMap[rid];
  }
}
