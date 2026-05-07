import db from "App/db/db";

// Returns annotations (other than `excludeId`) that share at least one
// `db.points` reference with the given annotation. Two annotations are
// "connected" when their `points[].id` sets intersect — typically because
// they were drawn against the same vertex during 3D drawing and
// `commitDrawnFaceService.insertOrReusePoints` collapsed them onto the
// same db.points record.
//
// Returns { sharedPointIds: Set<string>, connectedAnnotations: Array<annotation> }
export default async function findConnectedAnnotations(annotation, excludeId) {
  if (!annotation) {
    return { sharedPointIds: new Set(), connectedAnnotations: [] };
  }
  const ownPointIds = new Set(
    (annotation.points || []).map((p) => p.id).filter(Boolean)
  );
  if (ownPointIds.size === 0) {
    return { sharedPointIds: new Set(), connectedAnnotations: [] };
  }

  const all = await db.annotations.toArray();
  const connected = [];
  const shared = new Set();
  for (const other of all) {
    if (other.deletedAt) continue;
    if (other.id === (excludeId ?? annotation.id)) continue;
    const otherIds = (other.points || []).map((p) => p.id).filter(Boolean);
    let hasOverlap = false;
    for (const pid of otherIds) {
      if (ownPointIds.has(pid)) {
        hasOverlap = true;
        shared.add(pid);
      }
    }
    if (hasOverlap) connected.push(other);
  }
  return { sharedPointIds: shared, connectedAnnotations: connected };
}
