// Point refs a wrapper transform carries (same sets as
// applyWrapperTransformToPoints), as {id, x, y} in pixels.
//
// Pure: node-testable.
export default function getTransformedPointRefs(ann) {
  const refs = [];
  const add = (id, pt) => refs.push({ id, x: pt?.x, y: pt?.y });
  for (const pt of ann?.points ?? []) add(pt?.id, pt);
  for (const cut of ann?.cuts ?? []) {
    for (const pt of cut.points ?? []) add(pt?.id, pt);
  }
  for (const pt of ann?.innerPoints ?? []) add(pt?.id, pt);
  for (const line of [
    ...(ann?.guideLines ?? []),
    ...(ann?.isoHeightLines ?? []),
    ...(ann?.profileLines ?? []),
    ...(ann?.layoutLines ?? []),
    ...(ann?.heightCuts ?? []),
    ...(ann?.heightCutFaces ?? []),
  ]) {
    for (const pt of line?.points ?? []) add(pt?.pointId ?? pt?.id, pt);
  }
  return refs.filter((ref) => ref.id != null);
}
