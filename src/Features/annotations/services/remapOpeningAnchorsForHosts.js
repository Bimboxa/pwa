import db from "App/db/db";

import computeOpeningAnchorRemap from "Features/annotations/utils/computeOpeningAnchorRemap";
import updateAnnotationOpeningAnchor from "Features/annotations/services/updateAnnotationOpeningAnchor";

// Follows a host point id swap (vertex fork / snap-replace) on the opening
// rels anchored on that host: rewrites the anchor point ids with the same
// old-id -> new-id map applied to the host's refs. Run BEFORE
// reflowOpeningsForHost so anchorIsValid passes and the opening keeps its
// exact hostDistanceM from the reference vertex.
//
// Each rel write is isolated: a failure (e.g. ownership hook on a
// foreign-created rel) degrades to today's stale-anchor behavior for that rel
// instead of aborting the user's gesture or an ambient Dexie transaction.
export default async function remapOpeningAnchorsForHosts({
  hostAnnotationIds,
  pointIdMap,
}) {
  if (!hostAnnotationIds?.length || !pointIdMap) return [];

  const rels = await db.relAnnotationOpenings
    .where("hostAnnotationId")
    .anyOf(hostAnnotationIds)
    .toArray();

  const remappedRelIds = [];
  for (const rel of rels) {
    const changes = computeOpeningAnchorRemap(rel, pointIdMap);
    if (!changes) continue;
    try {
      await updateAnnotationOpeningAnchor(rel.id, changes);
      remappedRelIds.push(rel.id);
    } catch (e) {
      console.error("[openings] anchor remap failed", rel.id, e);
    }
  }
  return remappedRelIds;
}
