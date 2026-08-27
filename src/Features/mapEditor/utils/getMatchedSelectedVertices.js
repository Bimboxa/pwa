// Multi-selection shared-vertex drag: given the grabbed vertex, find the
// SELECTED annotations sharing it — same pointId anywhere, or a distinct
// pointId at the same coordinates on the main contour / cuts (guideLines,
// innerPoints, iso/profile lines have unique ids by construction and a
// coordinate coincidence there is accidental).
// Tolerance convention mirrors detectSharedPoints (1 image px).

const DEFAULT_TOLERANCE_PX = 1;

export default function getMatchedSelectedVertices({
  annotations,
  selectedAnnotationIds,
  pointId,
  pos,
  tolerancePx = DEFAULT_TOLERANCE_PX,
  canEdit,
}) {
  if (!pointId || !pos || !annotations?.length) return null;
  if (!selectedAnnotationIds || selectedAnnotationIds.length < 2) return null;

  const selectedSet = new Set(selectedAnnotationIds);
  const matchedAnnotationIds = [];
  const matchedPointIds = new Set([pointId]);

  const isCoincident = (pt) =>
    pt?.id &&
    pt.id !== pointId &&
    Number.isFinite(pt.x) &&
    Number.isFinite(pt.y) &&
    Math.hypot(pt.x - pos.x, pt.y - pos.y) <= tolerancePx;

  for (const ann of annotations) {
    if (!selectedSet.has(ann.id)) continue;

    const referencesPointId =
      ann.points?.some((pt) => pt.id === pointId) ||
      ann.cuts?.some((cut) => cut.points?.some((pt) => pt.id === pointId)) ||
      ann.innerPoints?.some((pt) => pt.id === pointId) ||
      [
        ...(ann.guideLines ?? []),
        ...(ann.isoHeightLines ?? []),
        ...(ann.profileLines ?? []),
      ].some((l) =>
        l?.points?.some((g) => g.pointId === pointId || g.id === pointId)
      );

    const coincidentIds = [];
    for (const pt of ann.points ?? []) {
      if (isCoincident(pt)) coincidentIds.push(pt.id);
    }
    for (const cut of ann.cuts ?? []) {
      for (const pt of cut.points ?? []) {
        if (isCoincident(pt)) coincidentIds.push(pt.id);
      }
    }

    if (!referencesPointId && !coincidentIds.length) continue;
    if (canEdit && !canEdit(ann.id)) continue;

    matchedAnnotationIds.push(ann.id);
    for (const id of coincidentIds) matchedPointIds.add(id);
  }

  if (matchedAnnotationIds.length < 2) return null;

  return {
    annotationIds: matchedAnnotationIds,
    pointIds: [...matchedPointIds],
  };
}
