import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

// Writes a per-vertex elevation offset back to the annotation. `offsetBottom` /
// `offsetTop` live on the annotation.points[] references (meters), NOT in
// db.points (which only stores normalized x/y). pointIndex matches the resolved
// points order returned by useAnnotationsV2.
export default async function commitElevationOffsetService({
  annotationId,
  pointIndex,
  edge, // "TOP" | "BOTTOM"
  value, // meters
  dispatch,
}) {
  if (!annotationId || pointIndex == null) return;

  const annotation = await db.annotations.get(annotationId);
  if (!annotation?.points?.[pointIndex]) return;

  const field = edge === "TOP" ? "offsetTop" : "offsetBottom";
  const nextPoints = annotation.points.map((p, i) =>
    i === pointIndex ? { ...p, [field]: value } : p
  );

  await db.annotations.update(annotationId, { points: nextPoints });
  if (dispatch) dispatch(triggerAnnotationsUpdate());
}
