import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import { BLOCK_DRAWING_SHAPE, BLOCK_INSTANCE_TYPE } from "../utils/blockTypes";

// First BLOCK template of the scope pointing to the block, or null.
export async function findBlockTemplateId({ blockId, projectId, scopeId }) {
  if (!blockId || !projectId) return null;
  const templates = (
    await db.annotationTemplates.where("projectId").equals(projectId).toArray()
  ).filter(
    (t) =>
      !t.deletedAt &&
      t.drawingShape === BLOCK_DRAWING_SHAPE &&
      t.blockId === blockId
  );
  if (templates.length <= 1 || !scopeId) return templates[0]?.id ?? null;
  const listingIds = [...new Set(templates.map((t) => t.listingId))];
  const listings = await db.listings.bulkGet(listingIds);
  const scopeListingIds = new Set(
    listings.filter((l) => l?.scopeId === scopeId).map((l) => l.id)
  );
  return (
    templates.find((t) => scopeListingIds.has(t.listingId)) ?? templates[0]
  ).id;
}

// Creates one instance of a block on a regular base map.
// The instance copies NO geometry: it stores a zero-size anchor bbox (its
// center = the insertion point, normalized like db.points), a rotation in
// degrees (clockwise on screen) and an altitude (offsetZ, meters).
// A scope-level templateless row (no listing): scoped by its own scopeId.
// It carries the id of the BLOCK template of its block (`annotationTemplateId`:
// eye / solo / count of the template row) — the one given, else the first
// BLOCK template of the scope pointing to the block (placement from the
// library), else none.
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
  annotationTemplateId = null,
}) {
  if (!blockId || !baseMapId || !projectId || !scopeId) return null;
  if (!Number.isFinite(anchor?.x) || !Number.isFinite(anchor?.y)) return null;

  const [block, baseMap] = await Promise.all([
    db.blocks.get(blockId),
    db.baseMaps.get(baseMapId),
  ]);
  if (!block || block.deletedAt) return null;
  if (!baseMap || baseMap.deletedAt || baseMap.isBlocksBaseMap) return null;

  const templateId =
    annotationTemplateId ??
    (await findBlockTemplateId({ blockId, projectId, scopeId }));

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
    ...(templateId ? { annotationTemplateId: templateId } : {}),
  };
  await db.annotations.add(instance);
  return instance;
}
