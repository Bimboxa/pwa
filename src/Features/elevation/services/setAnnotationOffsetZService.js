import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

// Sets the annotation's vertical offset relative to the baseMap plane. The 3D
// pipeline reads this field as `verticalLift` (see createAnnotationObject3D).
export default async function setAnnotationOffsetZService({
  annotationId,
  offsetZ,
  dispatch,
}) {
  if (!annotationId) return;
  await db.annotations.update(annotationId, { offsetZ });
  if (dispatch) dispatch(triggerAnnotationsUpdate());
}
