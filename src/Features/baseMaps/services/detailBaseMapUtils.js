import db from "App/db/db";

// Session cache key for the on-the-fly rendered image of a detail baseMap.
// Derived from every createdFrom field that changes the rendered pixels, so
// creation (findOrCreateDetailBaseMap) and hydration (BaseMap.createFromRecord)
// agree on cache hits. Kept pdfjs-free: BaseMap.js imports it statically.
export function getDetailImageCacheKey(record) {
  const c = record?.createdFrom;
  if (!c) return null;
  return `detail:${c.pdfFileName}@p${c.pageNumber}@r${c.rotation ?? 0}@d${
    c.dpi
  }`;
}

// Resolves the source resource of a detail baseMap. createdFrom.resourceId is
// only a hint: after the resource is deleted and re-imported the id changes,
// so fall back to matching the original PDF file name (the stable dedup key).
// Only returns a resource whose main file is actually present in db.files —
// callers need the bytes to render.
export async function resolveDetailResource({ createdFrom, projectId }) {
  if (!createdFrom) return null;

  const hasFile = async (resource) => {
    if (!resource || resource.deletedAt || !resource.fileName) return false;
    const fileRecord = await db.files.get(resource.fileName);
    return !!fileRecord?.fileArrayBuffer;
  };

  if (createdFrom.resourceId) {
    const resource = await db.resources.get(createdFrom.resourceId);
    if (await hasFile(resource)) return resource;
  }

  if (!createdFrom.pdfFileName || !projectId) return null;
  const candidates = (
    await db.resources.where("projectId").equals(projectId).toArray()
  ).filter((r) => !r.deletedAt && r.name === createdFrom.pdfFileName);
  for (const candidate of candidates) {
    if (await hasFile(candidate)) return candidate;
  }
  return null;
}
