import {
  isBboxPlacedAnnotationType,
  isPointBasedAnnotationType,
} from "../../threedAnnotationMove/utils/annotationTransformTypes.js";

// Annotation types the 2D « Déplacer » / « Tourner » tools accept, on top of
// the point-based list shared with the 3D tools (POLYLINE, POLYGON, STRIP,
// LINEAR_LAYOUT):
//   - COTE / RULER: their geometry lives in db.points too, so the whole
//     point pipeline (applyWrapperTransformToPoints, commitWrapperTransform)
//     applies unchanged — the dimension offsets are relative and follow;
//   - FREE_TEXT: inline normalized targetPoint / labelPoint, translated by
//     a dedicated write (getFreeTextMoveUpdates). Moved only, never turned.
//   - OBJECT_3D (imported GLB): bbox + rotation rewritten by a dedicated
//     write (getObject3DTransformUpdates), moved AND turned — in 3D too.
//   - BLOCK_INSTANCE (Features/blocks): same bbox-placed model as OBJECT_3D.
//   - BASE_MAP_LINK (section mark, Features/baseMapLinks — the mark on its
//     plan, or its clone located on a vertical base map): two db.points,
//     moved through the point pipeline; the commit then re-poses the
//     vertical base map the mark drives (resyncBaseMapLinksForAnnotationIds).
//     Moved only: the located clone is horizontal by construction, and the
//     direction of a mark is set by its own vertices.
export const MOVE_2D_EXTRA_TYPES = [
  "COTE",
  "RULER",
  "FREE_TEXT",
  "OBJECT_3D",
  "BLOCK_INSTANCE",
  "BASE_MAP_LINK",
];
export const ROTATE_2D_EXTRA_TYPES = [
  "COTE",
  "RULER",
  "OBJECT_3D",
  "BLOCK_INSTANCE",
];

// kind: "MOVE" | "ROTATE"
export function isTransformable2dType(kind, type) {
  if (isPointBasedAnnotationType(type)) return true;
  const extras =
    kind === "ROTATE" ? ROTATE_2D_EXTRA_TYPES : MOVE_2D_EXTRA_TYPES;
  return extras.includes(type);
}

// Types whose geometry is a set of db.points refs (written through
// commitWrapperTransform).
export function isPointHolderType(type) {
  return (
    isPointBasedAnnotationType(type) ||
    type === "COTE" ||
    type === "RULER" ||
    type === "BASE_MAP_LINK"
  );
}

export function isFreeTextType(type) {
  return type === "FREE_TEXT";
}

export function isObject3DType(type) {
  return isBboxPlacedAnnotationType(type);
}
