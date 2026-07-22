import {
  resolveDrawingShape,
  resolveDrawingShapeFromType,
  getAnnotationType,
} from "../constants/drawingShapeConfig";

// Resolves the annotation `type` to write when an annotation switches to
// another template.
//
// Several annotation types share one drawingShape (STRIP → POLYLINE,
// RECTANGLE → POLYGON). The type is therefore more specific than the
// template: when the new template draws the same shape, the annotation keeps
// its own type instead of falling back to the shape's default type (which
// would turn a STRIP drawn with the "Bande" tool into a plain POLYLINE).
export default function getAnnotationTypeOnTemplateChange(
  annotation,
  template
) {
  const resolvedShape = resolveDrawingShape(template);
  if (!resolvedShape) return null;

  const currentShape = resolveDrawingShapeFromType(annotation?.type);
  if (currentShape && currentShape === resolvedShape) return annotation.type;

  return getAnnotationType(resolvedShape);
}
