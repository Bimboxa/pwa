// Blocks context (Features/blocks): the main base map decides which family
// of base maps the editors show — the blocks base maps (block definitions)
// when it is one itself, the regular ones otherwise. The two families are
// never mixed: a base map belongs to the context when it is of the same
// family as the main base map.
export default function isInBlocksContext(baseMap, isBlocksContext) {
  return Boolean(baseMap?.isBlocksBaseMap) === Boolean(isBlocksContext);
}
