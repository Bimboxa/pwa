import { isPointBasedAnnotationType } from "../../threedAnnotationMove/utils/annotationTransformTypes.js";

// Annotation types the 2D « Déplacer » / « Tourner » tools accept, on top of
// the point-based list shared with the 3D tools (POLYLINE, POLYGON, STRIP,
// LINEAR_LAYOUT):
//   - COTE / RULER: their geometry lives in db.points too, so the whole
//     point pipeline (applyWrapperTransformToPoints, commitWrapperTransform)
//     applies unchanged — the dimension offsets are relative and follow;
//   - FREE_TEXT: inline normalized targetPoint / labelPoint, translated by
//     a dedicated write (getFreeTextMoveUpdates). Moved only, never turned.
// The 3D list (POINT_BASED_ANNOTATION_TYPES) stays as it is.
export const MOVE_2D_EXTRA_TYPES = ["COTE", "RULER", "FREE_TEXT"];
export const ROTATE_2D_EXTRA_TYPES = ["COTE", "RULER"];

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
    isPointBasedAnnotationType(type) || type === "COTE" || type === "RULER"
  );
}

export function isFreeTextType(type) {
  return type === "FREE_TEXT";
}
