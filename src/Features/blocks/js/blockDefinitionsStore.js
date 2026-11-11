// ---------------------------------------------------------------------------
// Block definitions store — tiny module-level store shared by every renderer
// of a block instance (NodeBlockInstanceStatic, culling, lasso).
//
// The definitions are computed ONCE (useBlockDefinitions, mounted by
// BlockDefinitionsDefs) and published here, so that N instance nodes do not
// each resolve the members of their block.
//
// Entry: { blockId, defId, label, boundsM, membersCount, totals }
//   totals: {surface, length, membersCount} — the quantities of
//   ONE instance of the block (sumBlockQties).
//   boundsM: {minX, minY, maxX, maxY} — bounding box of the members drawn in
//   the <defs> definition, in METERS in the block frame (origin = insertion
//   point, y down like the image). null when the block draws nothing.
//
// Import-free on purpose (read by pure utils / node tests).
// ---------------------------------------------------------------------------

let definitionsByBlockId = {};
const listeners = new Set();

export function getBlockDefId(blockId) {
  return `block-def-${blockId}`;
}

export function setBlockDefinitionsInStore(nextByBlockId) {
  definitionsByBlockId = nextByBlockId ?? {};
  listeners.forEach((listener) => listener());
}

export function getBlockDefinitionFromStore(blockId) {
  return blockId ? (definitionsByBlockId[blockId] ?? null) : null;
}

export function subscribeToBlockDefinitions(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
