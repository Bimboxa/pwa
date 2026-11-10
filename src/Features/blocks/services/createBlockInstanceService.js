import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import { BLOCK_INSTANCE_TYPE } from "../utils/blockTypes";

// Creates one instance of a block on a regular base map.
// The instance copies NO geometry: it stores a zero-size anchor bbox (its
// center = the insertion point, normalized like db.points), a rotation in
// degrees (clockwise on screen) and an altitude (offsetZ, meters).
// A scope-level templateless row (no listing): scoped by its own scopeId.
//
// anchor: normalized {x, y} on the host base map.
// Returns the created row, or null when the host is a blocks base map (no
// nested blocks) or the block does not exist.
export default async function createBlockInstanceService({
  blockId,
  baseMapId,
  anchor,
  projectId,
  scopeId,
  rotation = 0,
  offsetZ = 0,
  layerId = null,
}) {
  if (!blockId || !baseMapId || !projectId || !scopeId) return null;
  if (!Number.isFinite(anchor?.x) || !Number.isFinite(anchor?.y)) return null;

  const [block, baseMap] = await Promise.all([
    db.blocks.get(blockId),
    db.baseMaps.get(baseMapId),
  ]);
  if (!block || block.deletedAt) return null;
  if (!baseMap || baseMap.deletedAt || baseMap.isBlocksBaseMap) return null;

  const instance = {
    id: nanoid(),
    type: BLOCK_INSTANCE_TYPE,
    instanceOfBlockId: blockId,
    projectId,
    scopeId,
    listingId: null,
    isTemplateless: true,
    baseMapId,
    bbox: { x: anchor.x, y: anchor.y, width: 0, height: 0 },
    rotation: Number(rotation) || 0,
    ...(Number(offsetZ) ? { offsetZ: Number(offsetZ) } : {}),
    ...(layerId ? { layerId } : {}),
  };
  await db.annotations.add(instance);
  return instance;
}
