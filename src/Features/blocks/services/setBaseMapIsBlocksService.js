import db from "App/db/db";

import { isBlockInstanceAnnotation } from "../utils/blockTypes";

export const BLOCKS_BASE_MAP_REFUSAL = {
  HOSTS_INSTANCES: "HOSTS_INSTANCES",
  HOLDS_BLOCKS: "HOLDS_BLOCKS",
  NO_FOLDER: "NO_FOLDER",
};

// Turns a base map into a blocks base map (`isBlocksBaseMap`: the page where
// the annotations of one or several blocks are drawn), or back into a plan.
// The flag is mirrored on the versions, like createBlocksBaseMapService.
//
// - ON: refused while the base map hosts block instances (no nested blocks).
//   Its folder (`listingId`) is kept, so switching back restores it.
// - OFF: refused while it still defines a block (a member annotation, or the
//   insertion point of a block). A page created as a blocks base map has no
//   folder: it joins `fallbackListingId`.
//
// Returns { ok: true } or { ok: false, refusal } (BLOCKS_BASE_MAP_REFUSAL).
export default async function setBaseMapIsBlocksService({
  baseMapId,
  isBlocksBaseMap,
  fallbackListingId = null,
}) {
  const baseMap = baseMapId ? await db.baseMaps.get(baseMapId) : null;
  if (!baseMap || baseMap.deletedAt) return { ok: false };
  const next = Boolean(isBlocksBaseMap);
  if (Boolean(baseMap.isBlocksBaseMap) === next) return { ok: true };

  const annotations = (
    await db.annotations.where("baseMapId").equals(baseMapId).toArray()
  ).filter((a) => !a.deletedAt);

  const updates = { isBlocksBaseMap: next };
  if (next) {
    if (annotations.some(isBlockInstanceAnnotation))
      return { ok: false, refusal: BLOCKS_BASE_MAP_REFUSAL.HOSTS_INSTANCES };
  } else {
    const holdsMembers = annotations.some((a) => a.blockId);
    const holdsOrigin =
      !holdsMembers &&
      (
        await db.blocks.where("projectId").equals(baseMap.projectId).toArray()
      ).some((b) => !b.deletedAt && b.origin?.baseMapId === baseMapId);
    if (holdsMembers || holdsOrigin)
      return { ok: false, refusal: BLOCKS_BASE_MAP_REFUSAL.HOLDS_BLOCKS };
    if (!baseMap.listingId) {
      if (!fallbackListingId)
        return { ok: false, refusal: BLOCKS_BASE_MAP_REFUSAL.NO_FOLDER };
      updates.listingId = fallbackListingId;
    }
  }

  await db.transaction("rw", [db.baseMaps, db.baseMapVersions], async () => {
    await db.baseMaps.update(baseMapId, updates);
    const versionIds = await db.baseMapVersions
      .where("baseMapId")
      .equals(baseMapId)
      .primaryKeys();
    if (versionIds.length > 0) {
      await db.baseMapVersions.bulkUpdate(
        versionIds.map((key) => ({ key, changes: updates }))
      );
    }
  });
  return { ok: true };
}
