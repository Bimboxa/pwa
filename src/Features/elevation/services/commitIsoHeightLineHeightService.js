import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

// Writes the height (meters, offsetTop semantics vs the polygon's offsetZ) of
// one isoHeightLine back to the annotation. A contour line has ONE height —
// every point of the line moves together (this is what the single elevation
// handle edits).
export default async function commitIsoHeightLineHeightService({
  annotationId,
  index,
  height, // meters
  dispatch,
}) {
  if (!annotationId || !Number.isInteger(index) || index < 0) return;

  const annotation = await db.annotations.get(annotationId);
  if (!annotation?.isoHeightLines?.[index]) return;

  const h = Number(height) || 0;
  const isoHeightLines = annotation.isoHeightLines.map((l, i) =>
    i === index ? { ...l, height: h } : l
  );

  await db.annotations.update(annotationId, { isoHeightLines });
  if (dispatch) dispatch(triggerAnnotationsUpdate());
}
