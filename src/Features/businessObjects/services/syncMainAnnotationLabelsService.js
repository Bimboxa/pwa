import db from "App/db/db";

import getMainRelsOfBusinessObjectsService from "./getMainRelsOfBusinessObjectsService";

// Write-through of a business object's label into the rows of its main
// annotations. The displayed label is ALWAYS derived at read time
// (useAnnotationsV2 override), so this is best effort — it only keeps raw
// rows / exports consistent. Per-row try/catch: `annotations` is not
// ownership-exempt, a main annotation drawn by another user throws
// OwnershipError and is simply skipped. Call it OUTSIDE the object's own
// transaction.
export default async function syncMainAnnotationLabelsService({
  businessObjectId,
  label,
}) {
  if (!businessObjectId || label == null) return 0;
  const rels = await getMainRelsOfBusinessObjectsService([businessObjectId]);
  let updated = 0;
  for (const rel of rels) {
    try {
      const annotation = await db.annotations.get(rel.annotationId);
      if (!annotation || annotation.deletedAt) continue;
      if (annotation.label === label) continue;
      await db.annotations.update(rel.annotationId, { label });
      updated += 1;
    } catch (e) {
      console.warn(
        "[syncMainAnnotationLabelsService] skipped annotation",
        rel.annotationId,
        e?.message
      );
    }
  }
  return updated;
}
