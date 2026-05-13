// Returns the annotation's `points` and `hiddenSegmentsIdx` with all refs
// flagged `isSliding: true` removed (and indices remapped). "Sliding" refs
// are auto-generated decorations on top of a "raw" polyline / polygon
// (e.g. inflection points added by the slope move): they must not feed into
// transient mesh construction nor into the next commit's geometry — those
// always operate on the underlying raw geometry, with sliding refs
// re-derived at the end of each commit.
//
// Hidden segments adjacent to a sliding ref are dropped (they only existed
// to mask the auto-split's "negative span" half). Hidden segments whose
// both endpoints are non-sliding are preserved and remapped to the new
// (post-strip) segment indexing.
//
// Returns:
//   { points, hiddenSegmentsIdx, strippedIds }
// where `strippedIds` is the list of point-ids that were removed. The
// caller is responsible for any downstream cleanup (e.g. `db.points.delete`).
export default function stripSlidingFromAnnotation(annotation) {
  const points = annotation?.points || [];
  const N = points.length;
  if (N === 0) {
    return { points: [], hiddenSegmentsIdx: [], strippedIds: [] };
  }
  const slidingIdx = new Set();
  const strippedIds = [];
  for (let i = 0; i < N; i++) {
    if (points[i]?.isSliding) {
      slidingIdx.add(i);
      if (points[i].id) strippedIds.push(points[i].id);
    }
  }
  if (slidingIdx.size === 0) {
    return {
      points,
      hiddenSegmentsIdx: annotation.hiddenSegmentsIdx || [],
      strippedIds: [],
    };
  }
  const newPoints = [];
  const oldToNew = new Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    if (slidingIdx.has(i)) continue;
    oldToNew[i] = newPoints.length;
    newPoints.push(points[i]);
  }
  const closeLine = !!annotation.closeLine || annotation.type === "POLYGON";
  const segmentCount = closeLine ? N : Math.max(0, N - 1);
  const oldHidden = new Set(annotation.hiddenSegmentsIdx || []);
  const newHidden = [];
  for (let i = 0; i < segmentCount; i++) {
    if (!oldHidden.has(i)) continue;
    const a = i;
    const b = (i + 1) % N;
    if (slidingIdx.has(a) || slidingIdx.has(b)) continue;
    newHidden.push(oldToNew[a]);
  }
  return { points: newPoints, hiddenSegmentsIdx: newHidden, strippedIds };
}
