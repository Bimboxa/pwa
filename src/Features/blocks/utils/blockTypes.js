// ---------------------------------------------------------------------------
// Blocks (« Blocs ») — a named group of annotations defined once and
// instantiated many times (AutoCAD-like block).
//
// - BLOCK row (db.blocks): {id, projectId, scopeId, label, origin}.
//   `origin = {baseMapId, x, y, z}` is the insertion point: x, y normalized
//   like db.points on the origin blocks base map, z in meters. null until the
//   first member is linked.
// - MEMBER: an annotation drawn on a blocks base map (baseMap.isBlocksBaseMap)
//   carrying `blockId`.
// - INSTANCE: an annotation of type BLOCK_INSTANCE on a regular base map,
//   carrying `instanceOfBlockId`. It never copies geometry.
//
// This file stays import-free (shared by node unit tests).
// ---------------------------------------------------------------------------

export const BLOCK_INSTANCE_TYPE = "BLOCK_INSTANCE";

export const BLOCK_LABEL = "Bloc";
export const BLOCKS_LABEL = "Blocs";
export const DEFAULT_BLOCKS_BASE_MAP_NAME = "Blocs";

// Blocks base map: a square white page, large enough for a few blocks.
export const BLOCKS_BASE_MAP_SIDE_M = 20;
export const BLOCKS_BASE_MAP_SCALE = 50; // 1:50

export function isBlockInstanceType(type) {
  return type === BLOCK_INSTANCE_TYPE;
}

export function isBlockInstanceAnnotation(annotation) {
  return isBlockInstanceType(annotation?.type);
}

export function isBlockMemberAnnotation(annotation) {
  return Boolean(annotation?.blockId) && !isBlockInstanceAnnotation(annotation);
}
