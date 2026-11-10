import { isBlockInstanceAnnotation } from "./blockTypes.js";

// Groups annotations by the block they are a member of.
// Returns { [blockId]: annotation[] } — instances and unlinked rows are
// skipped; the input order is kept inside each group.
export default function groupBlockMembers(annotations) {
  const membersByBlockId = {};
  if (!Array.isArray(annotations)) return membersByBlockId;
  for (const annotation of annotations) {
    const blockId = annotation?.blockId;
    if (!blockId || isBlockInstanceAnnotation(annotation)) continue;
    if (!membersByBlockId[blockId]) membersByBlockId[blockId] = [];
    membersByBlockId[blockId].push(annotation);
  }
  return membersByBlockId;
}
