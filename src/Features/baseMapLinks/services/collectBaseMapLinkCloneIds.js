import db from "App/db/db";

// Ids of the live BASE_MAP_LINK clones whose source link is one of the given
// annotation ids — used by the delete cascades (a clone without its source
// is meaningless) and by the link retarget (a clone on the old target is
// stale).
export default async function collectBaseMapLinkCloneIds(sourceIds) {
  const set = new Set((sourceIds ?? []).filter(Boolean));
  if (set.size === 0) return [];
  const clones = await db.annotations
    .filter(
      (a) =>
        !a.deletedAt &&
        a.type === "BASE_MAP_LINK" &&
        set.has(a.sourceLinkAnnotationId)
    )
    .toArray();
  return clones.map((a) => a.id);
}
