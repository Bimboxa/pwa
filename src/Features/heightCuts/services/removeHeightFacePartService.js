import {
  HEIGHT_CUT_PART_TYPE,
  HEIGHT_FACE_PART_TYPE,
} from "../constants/heightCutConstants";

import removeHeightCutService from "./removeHeightCutService";

// Delete key on a sub-selected height part of a POLYGON.
// - `{id}::HEIGHT_CUT::{heightCutId}` (open trace): the trace is removed ;
// - `{id}::HEIGHT_FACE::{faceKey}`: the face loses its own delta (seed
//   entry) ; the whole inside of a closed shape is removed with its shape. A
//   face at the main level with nothing of its own is left alone.
//
// annotation: the RESOLVED annotation (heightFaces in pixels).
export default async function removeHeightFacePartService({
  annotation,
  partId,
}) {
  if (!annotation?.id || !partId) return;
  const [, type, ...rest] = partId.split("::");

  if (type === HEIGHT_CUT_PART_TYPE) {
    await removeHeightCutService({
      annotationId: annotation.id,
      heightCutId: rest[0],
    });
    return;
  }
  if (type !== HEIGHT_FACE_PART_TYPE) return;

  const faces = annotation.heightFaces ?? [];
  const face = faces.find((f) => f.key === rest.join("::"));
  if (!face) return;
  const isWholeRingFace =
    Boolean(face.heightCutId) &&
    !face.faceEntryId &&
    faces.filter((f) => f.heightCutId === face.heightCutId).length === 1;
  if (!face.faceEntryId && !isWholeRingFace) return;
  await removeHeightCutService({
    annotationId: annotation.id,
    heightCutId: isWholeRingFace ? face.heightCutId : null,
    faceEntryId: face.faceEntryId,
  });
}
