import db from "App/db/db";

// Finds the detail baseMap matching a (pdf file name, page) pair, or null.
// Dedup deliberately ignores rotation — the rotation of the first creation
// wins, so annotations placed on the detail stay aligned (same rule as
// findOrCreateDetailBaseMap, which delegates its dedup step here).
export default async function findDetailBaseMap({
  resourceId,
  pageNumber,
  projectId,
}) {
  const resource = await db.resources.get(resourceId);
  if (!resource || resource.deletedAt) return null;
  const pdfFileName = resource.name;

  const existing = await db.baseMaps
    .where("projectId")
    .equals(projectId)
    .filter(
      (r) =>
        !r.deletedAt &&
        r.isDetail &&
        r.createdFrom?.pdfFileName === pdfFileName &&
        r.createdFrom?.pageNumber === pageNumber
    )
    .first();
  return existing ?? null;
}
