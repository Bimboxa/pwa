import db from "App/db/db";

import { sameBboxInRatio } from "../utils/bboxInRatio";

// Finds the detail baseMap matching a (pdf file name, page, crop) triple, or
// null. `bboxInRatio` null = the whole page (the historical behaviour): a
// cropped zone and the whole page are distinct detail baseMaps.
// Dedup deliberately ignores rotation — the rotation of the first creation
// wins, so annotations placed on the detail stay aligned (same rule as
// findOrCreateDetailBaseMap, which delegates its dedup step here).
export default async function findDetailBaseMap({
  resourceId,
  pageNumber,
  projectId,
  bboxInRatio = null,
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
        r.createdFrom?.pageNumber === pageNumber &&
        sameBboxInRatio(r.createdFrom?.bboxInRatio, bboxInRatio)
    )
    .first();
  return existing ?? null;
}
