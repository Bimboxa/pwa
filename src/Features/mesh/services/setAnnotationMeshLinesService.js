import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";

// Persist the mesh cut-line definition on the parent annotation so the mesh is
// re-editable and non-destructive. `meshLines` are stored in a normalized,
// space-tagged form (see saveMeshService):
//   POLYGON  → { id, orientation, p1:{x,y}, p2:{x,y} } in [0..1] baseMap coords
//   POLYLINE → { id, orientation, p1:{u,z}, p2:{u,z} } in elevation param space
export default async function setAnnotationMeshLinesService({
  annotationId,
  meshLines,
  dispatch,
}) {
  if (!annotationId) return;
  await db.annotations.update(annotationId, { meshLines: meshLines ?? [] });
  dispatch?.(triggerAnnotationsUpdate());
}
