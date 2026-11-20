// Blocks context of an info (Features/blocks): `viewContext.isBlocksContext`
// records whether it was written with a blocks base map as the main one. Its
// PIN is drawn in its own context only — a blocks one while a blocks base
// map is the main one, the other ones (the default: no flag) otherwise. The
// strip keeps every info (the way into / out of a block).
export default function isCommentInBlocksContext(comment, isBlocksContext) {
  return (
    Boolean(comment?.viewContext?.isBlocksContext) === Boolean(isBlocksContext)
  );
}
