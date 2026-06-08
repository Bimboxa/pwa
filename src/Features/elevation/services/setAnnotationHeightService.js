import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

// Sets the polyline's global height (meters).
export default async function setAnnotationHeightService({
  annotationId,
  height,
  dispatch,
}) {
  if (!annotationId) return;
  await db.annotations.update(annotationId, { height });
  if (dispatch) dispatch(triggerAnnotationsUpdate());
}
