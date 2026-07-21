import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

// Batch variant of commitElevationOffsetService: writes the SAME offset value
// to several main-ring vertices in one db update (e.g. the profile-extremity
// handles of the elevation panel, where several corners share the same
// projected x). pointIndexes match the resolved points order.
export default async function commitElevationOffsetsService({
  annotationId,
  pointIndexes,
  edge, // "TOP" | "BOTTOM"
  value, // meters
  dispatch,
}) {
  if (!annotationId || !Array.isArray(pointIndexes) || !pointIndexes.length) {
    return;
  }
  const annotation = await db.annotations.get(annotationId);
  if (!annotation?.points?.length) return;

  const field = edge === "TOP" ? "offsetTop" : "offsetBottom";
  const targets = new Set(pointIndexes);
  const nextPoints = annotation.points.map((p, i) =>
    targets.has(i) ? { ...p, [field]: value } : p
  );

  await db.annotations.update(annotationId, { points: nextPoints });
  if (dispatch) dispatch(triggerAnnotationsUpdate());
}
