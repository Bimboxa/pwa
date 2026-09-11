import {
  resolveDrawingShape,
  resolveDrawingShapeFromType,
  getAnnotationType,
  getGeometryKindFromType,
} from "../constants/drawingShapeConfig";
import getEffectiveAnnotationType from "./getEffectiveAnnotationType";

// Resolves the annotation `type` to write when an annotation switches to
// another template (null when the template has no resolvable shape).
//
// Several annotation types share one drawingShape (STRIP → POLYLINE,
// RECTANGLE → POLYGON). The type is therefore more specific than the
// template: when the new template draws the same shape, the annotation keeps
// its own type instead of falling back to the shape's default type (which
// would turn a STRIP drawn with the "Bande" tool into a plain POLYLINE).
//
// The type only changes WITHIN its geometry family (see
// getGeometryKindFromType): a template is a style preset, it cannot rebuild
// the geometry. A POLYGON assigned a LABEL template keeps `type: "POLYGON"`
// (with the template's colors) — writing "LABEL" would leave a row without
// targetPoint / labelPoint that crashes the resolver on the next read.
export default function getAnnotationTypeOnTemplateChange(
  annotation,
  template
) {
  const resolvedShape = resolveDrawingShape(template);
  if (!resolvedShape) return null;

  const currentType = getEffectiveAnnotationType(annotation);
  const currentShape = resolveDrawingShapeFromType(currentType);
  if (currentShape && currentShape === resolvedShape) return currentType;

  const nextType = getAnnotationType(resolvedShape);
  if (!nextType) return null;

  const currentKind = getGeometryKindFromType(currentType);
  if (currentKind && currentKind !== getGeometryKindFromType(nextType)) {
    // Cross-family switch: hold the geometry-consistent (healed) type, so a
    // row corrupted by the former behavior is repaired by its next
    // re-template (the caller only writes it when it differs).
    return currentType;
  }

  return nextType;
}
