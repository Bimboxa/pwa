import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

// Writes the inline height (meters, offsetTop semantics vs the polygon's
// offsetZ) of ONE interior profileLine vertex back to the annotation.
// Endpoints are continuity-locked (their height is derived from the contour
// at resolve time) — writes on them are ignored.
export default async function updateProfileVertexHeightService({
  annotationId,
  profileIndex,
  vertexIndex,
  height, // meters
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
  if (!line?.points?.[vertexIndex]) return;
  if (vertexIndex === 0 || vertexIndex === line.points.length - 1) return;

  const h = Number(height) || 0;
  const profileLines = annotation.profileLines.map((l, i) =>
    i === profileIndex
      ? {
          ...l,
          points: l.points.map((ref, j) =>
            j === vertexIndex ? { ...ref, height: h } : ref
          ),
        }
      : l
  );

  await db.annotations.update(annotationId, { profileLines });
  if (dispatch) dispatch(triggerAnnotationsUpdate());
}
