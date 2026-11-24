import db from "App/db/db";

import sortPhases from "../utils/sortPhases";

// Phase rows to rewrite when business objects are deleted — a no-op for the
// objects that are not phases (no row points at them). Runs INSIDE the
// caller's transaction (db.businessObjects + db.relsPhaseAnnotation), BEFORE
// the objects are deleted.
// - EXCLUDE on a deleted phase: dropped;
// - START on a deleted phase: moved to the next remaining phase;
// - END on a deleted phase: moved to the previous remaining phase.
// A period left without any remaining phase loses all its rows: the
// annotation reads as present everywhere again rather than nowhere.
export default async function reassignPhaseRelsOnDeleteService(deletedIds) {
  if (!deletedIds?.length) return 0;
  const deleted = new Set(deletedIds);
  const rels = (
    await db.relsPhaseAnnotation.where("phaseId").anyOf(deletedIds).toArray()
  ).filter((r) => !r.deletedAt);
  if (rels.length === 0) return 0;

  const listingIds = [...new Set(rels.map((r) => r.listingId))];
  const phasesByListingId = new Map();
  for (const listingId of listingIds) {
    const objects = await db.businessObjects
      .where("listingId")
      .equals(listingId)
      .toArray();
    phasesByListingId.set(listingId, sortPhases(objects));
  }

  const idsToDelete = [];
  const updates = [];
  const orphanAnnotationKeys = new Set();
  rels.forEach((rel) => {
    if (rel.type === "EXCLUDE") {
      idsToDelete.push(rel.id);
      return;
    }
    const phases = phasesByListingId.get(rel.listingId) ?? [];
    const index = phases.findIndex((p) => p.id === rel.phaseId);
    const step = rel.type === "START" ? 1 : -1;
    let target = null;
    for (let i = index + step; i >= 0 && i < phases.length; i += step) {
      if (!deleted.has(phases[i].id)) {
        target = phases[i];
        break;
      }
    }
    if (index < 0 || !target) {
      idsToDelete.push(rel.id);
      orphanAnnotationKeys.add(`${rel.listingId}|${rel.annotationId}`);
      return;
    }
    updates.push({ key: rel.id, changes: { phaseId: target.id } });
  });

  // a period with no phase left: drop its other rows too
  if (orphanAnnotationKeys.size > 0) {
    const annotationIds = [...orphanAnnotationKeys].map(
      (key) => key.split("|")[1]
    );
    const others = await db.relsPhaseAnnotation
      .where("annotationId")
      .anyOf(annotationIds)
      .toArray();
    const handled = new Set(idsToDelete);
    others.forEach((r) => {
      if (r.deletedAt || handled.has(r.id)) return;
      if (orphanAnnotationKeys.has(`${r.listingId}|${r.annotationId}`))
        idsToDelete.push(r.id);
    });
  }
  const dropped = new Set(idsToDelete);
  const liveUpdates = updates.filter((u) => !dropped.has(u.key));

  if (idsToDelete.length > 0)
    await db.relsPhaseAnnotation.bulkDelete(idsToDelete);
  if (liveUpdates.length > 0)
    await db.relsPhaseAnnotation.bulkUpdate(liveUpdates);
  return idsToDelete.length + liveUpdates.length;
}
