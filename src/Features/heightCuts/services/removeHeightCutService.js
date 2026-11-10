import db from "App/db/db";

import softDeleteOrphanPoints from "Features/annotations/services/softDeleteOrphanPoints";

// Removes a height cut trace (heightCutId) and / or the seed entry of a face
// (faceEntryId) from a POLYGON. The faces are recomputed at read time: a face
// losing its trace merges back with its neighbor, a face losing its entry
// goes back to the level of the trace around it (or the main level).
// The points only these rows referenced are dropped (best effort).
export default async function removeHeightCutService({
  annotationId,
  heightCutId,
  faceEntryId,
}) {
  const raw = await db.annotations.get(annotationId);
  if (!raw) return;

  const removed = [];
  const updates = {};
  if (heightCutId != null && raw.heightCuts?.some((t) => t.id === heightCutId)) {
    removed.push(...raw.heightCuts.filter((t) => t.id === heightCutId));
    updates.heightCuts = raw.heightCuts.filter((t) => t.id !== heightCutId);
  }
  if (
    faceEntryId != null &&
    raw.heightCutFaces?.some((e) => e.id === faceEntryId)
  ) {
    removed.push(...raw.heightCutFaces.filter((e) => e.id === faceEntryId));
    updates.heightCutFaces = raw.heightCutFaces.filter(
      (e) => e.id !== faceEntryId
    );
  }
  if (!removed.length) return;

  await db.annotations.update(annotationId, updates);

  try {
    const candidatePointIds = new Set(
      removed.flatMap((row) => (row.points ?? []).map((p) => p.pointId))
    );
    await softDeleteOrphanPoints({
      baseMapIds: [raw.baseMapId],
      candidatePointIds,
    });
  } catch (error) {
    console.warn("[heightCuts] orphan points cleanup failed", error);
  }
}
