import { nanoid } from "nanoid";

import db from "App/db/db";

// Links an annotation to a zone. Invariant: at most ONE live rel per
// (annotationId, zoning listingId) — associating to another zone of the SAME
// zoning replaces the previous rel (soft-delete). Rels to zones of different
// zonings coexist.
export default async function addZoneToAnnotationService({ annotation, zone }) {
  if (!annotation?.id || !zone?.id) return null;

  return db.transaction("rw", db.relsZoneAnnotation, async () => {
    const existingRels = (
      await db.relsZoneAnnotation
        .where("annotationId")
        .equals(annotation.id)
        .toArray()
    ).filter((r) => !r.deletedAt && r.listingId === zone.listingId);

    const sameZoneRel = existingRels.find((r) => r.zoneId === zone.id);
    if (sameZoneRel) return sameZoneRel;

    const relIdsToReplace = existingRels.map((r) => r.id);
    if (relIdsToReplace.length > 0) {
      // soft-delete middleware sets deletedAt
      await db.relsZoneAnnotation.bulkDelete(relIdsToReplace);
    }

    const rel = {
      id: nanoid(),
      projectId: zone.projectId ?? annotation.projectId,
      scopeId: zone.scopeId,
      annotationId: annotation.id,
      zoneId: zone.id,
      listingId: zone.listingId,
    };
    await db.relsZoneAnnotation.add(rel);
    return rel;
  });
}
