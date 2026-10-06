import db from "App/db/db";

// Writes one per-point offset (`offsetTop` | `offsetBottom`, meters) on every
// ref of `pointId` inside the annotation: the outer ring, the cut rings, the
// inner points (keyed `id`) and the guide lines (keyed `pointId`) — the
// pattern of useUpdateSelectedPoints. db.points is never touched (offsets
// live on the annotation's refs, see docs/threed/POINTS_AND_TRANSFORMS.md).
// Returns true when something was written.
export default async function commitPointOffsetService({
  annotationId,
  pointId,
  field,
  value,
}) {
  if (!annotationId || !pointId) return false;
  if (field !== "offsetTop" && field !== "offsetBottom") return false;
  const annotation = await db.annotations.get(annotationId);
  if (!annotation) return false;

  const partial = { [field]: value };
  let touched = false;
  const remap = (refs) =>
    (refs || []).map((ref) => {
      if (ref?.id !== pointId) return ref;
      touched = true;
      return { ...ref, ...partial };
    });

  const updates = { points: remap(annotation.points) };
  if (annotation.cuts) {
    updates.cuts = annotation.cuts.map((cut) => ({
      ...cut,
      points: remap(cut.points),
    }));
  }
  if (annotation.innerPoints) {
    updates.innerPoints = remap(annotation.innerPoints);
  }
  if (Array.isArray(annotation.guideLines)) {
    updates.guideLines = annotation.guideLines.map((line) => ({
      ...line,
      points: (line?.points || []).map((g) => {
        if (g?.pointId !== pointId) return g;
        touched = true;
        return { ...g, ...partial };
      }),
    }));
  }
  if (!touched) return false;
  await db.annotations.update(annotationId, updates);
  return true;
}
