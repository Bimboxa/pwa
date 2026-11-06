// Drops the annotations hidden with « Masquer l'annotation » from a viewer's
// list. `hiddenIdSet`: selectUserHiddenAnnotationIdSet (null = nothing to
// filter). The input array is returned as is when nothing is dropped, and the
// kept elements keep their reference (the 3D diff rebuilds nothing for them).
//
// Pure: node-testable.
export default function filterUserHiddenAnnotations(annotations, hiddenIdSet) {
  if (!annotations || !hiddenIdSet?.size) return annotations;
  const result = annotations.filter((a) => !hiddenIdSet.has(a.id));
  return result.length === annotations.length ? annotations : result;
}
