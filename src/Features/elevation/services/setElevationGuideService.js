import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

// Writes the elevation guide image config back to the annotation:
//   elevationGuide = { baseMapId, x?, y? }
// x/y = top-left position of the guide image in the elevation editor's world
// space (profile coords). Pass guide = null to remove the guide.
export default async function setElevationGuideService({
  annotationId,
  guide,
  dispatch,
}) {
  if (!annotationId) return;
  const annotation = await db.annotations.get(annotationId);
  if (!annotation) return;

  await db.annotations.update(annotationId, {
    elevationGuide: guide ?? null,
  });
  if (dispatch) dispatch(triggerAnnotationsUpdate());
}
