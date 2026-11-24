// Drops the annotations that are in none of the displayed phases from a
// viewer's list. `hiddenIdSet`: usePhaseHiddenAnnotationIdSet (empty =
// nothing to filter). Base map annotations are always kept. The input array
// is returned as is when nothing is dropped, and the kept elements keep
// their reference (the 3D diff rebuilds nothing for them).
//
// Pure: node-testable.
export default function filterPhaseHiddenAnnotations(annotations, hiddenIdSet) {
  if (!annotations || !hiddenIdSet?.size) return annotations;
  const result = annotations.filter(
    (a) => a.isBaseMapAnnotation || !hiddenIdSet.has(a.id)
  );
  return result.length === annotations.length ? annotations : result;
}
