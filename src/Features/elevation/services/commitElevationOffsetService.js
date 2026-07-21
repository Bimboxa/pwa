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
  // Iso-flagged contour segments (isoHeightSegmentsIdx) are constant-height:
  // dragging one endpoint's TOP mirrors the value to the other endpoint so the
  // segment stays level.
  const targetIdxs = new Set([pointIndex]);
  if (edge === "TOP" && Array.isArray(annotation.isoHeightSegmentsIdx)) {
    const nRing = annotation.points.length;
    for (const segIdx of annotation.isoHeightSegmentsIdx) {
      if (!Number.isInteger(segIdx)) continue;
      if (segIdx === pointIndex) targetIdxs.add((segIdx + 1) % nRing);
      else if ((segIdx + 1) % nRing === pointIndex) targetIdxs.add(segIdx);
    }
  }
  const nextPoints = annotation.points.map((p, i) =>
    targetIdxs.has(i) ? { ...p, [field]: value } : p
  );

  await db.annotations.update(annotationId, { points: nextPoints });
  if (dispatch) dispatch(triggerAnnotationsUpdate());
}
