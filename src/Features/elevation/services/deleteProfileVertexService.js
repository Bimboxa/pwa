import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

// Removes ONE interior vertex from a profileLine (endpoints are
// contour-anchored and cannot be removed here — deleting the whole line goes
// through useDeleteProfileLine). The referenced db.points row is deleted too.
export default async function deleteProfileVertexService({
  annotationId,
  profileIndex,
  vertexIndex,
  dispatch,
}) {
  if (
    !annotationId ||
    !Number.isInteger(profileIndex) ||
    !Number.isInteger(vertexIndex)
  ) {
    return;
  }

  const annotation = await db.annotations.get(annotationId);
  const line = annotation?.profileLines?.[profileIndex];
  const ref = line?.points?.[vertexIndex];
  if (!ref) return;
  if (vertexIndex === 0 || vertexIndex === line.points.length - 1) return;
  if (line.points.length <= 2) return;

  const profileLines = annotation.profileLines.map((l, i) =>
    i === profileIndex
      ? { ...l, points: l.points.filter((_, j) => j !== vertexIndex) }
      : l
  );

  await db.transaction("rw", db.points, db.annotations, async () => {
    if (ref.pointId) await db.points.delete(ref.pointId);
    await db.annotations.update(annotationId, { profileLines });
  });

  if (dispatch) dispatch(triggerAnnotationsUpdate());
}
