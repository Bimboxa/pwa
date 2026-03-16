import {
  resolveDrawingShapeFromType,
  getDefaultsForShape,
} from "Features/annotations/constants/drawingShapeConfig";

// Fills in missing style properties on an annotation using defaults
// from DRAWING_SHAPE_CONFIG. This is a safety net for the rendering layer
// so that Node components don't need their own scattered fallback values.
export default function resolveAnnotationDefaults(annotation) {
  if (!annotation) return annotation;

  const drawingShape =
    annotation.drawingShape ?? resolveDrawingShapeFromType(annotation.type);
  if (!drawingShape) return annotation;

  const defaults = getDefaultsForShape(drawingShape);
  if (!defaults || Object.keys(defaults).length === 0) return annotation;

  let patched = null;

  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (annotation[key] === null || annotation[key] === undefined) {
      if (!patched) patched = { ...annotation };
      patched[key] = defaultValue;
    }
  }

  return patched ?? annotation;
}
