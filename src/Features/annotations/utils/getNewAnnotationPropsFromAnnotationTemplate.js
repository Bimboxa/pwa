import {
  getConfigurableProps,
  getDefaultsForShape,
  getAnnotationType,
  resolveDrawingShape,
} from "Features/annotations/constants/drawingShapeConfig";

// Keys that are always copied from template to annotation (beyond configurable props).
const ALWAYS_COPY_KEYS = [
  "listingId",
  "projectId",
  "label",
  "overrideFields",
  "drawingShape",
  "height",
  "offsetZ",
  // Copied at creation so the annotation carries its own isExt value (like
  // height). When unlocked the template is not a read-time fallback, so the
  // default has to be seeded here; when locked the resolver overrides it anyway.
  "isExt",
  // Free annotations (no entity, no user-managed template) are backed by a
  // hidden system template carrying this flag; it must reach the annotation.
  "isFreeAnnotation",
  // Zone delimitation polygons (zonings module): per-zone templates carry this
  // flag; the commit skips the entity creation for them.
  "isZoneAnnotation",
];

export default function getNewAnnotationPropsFromAnnotationTemplate(
  annotationTemplate
) {
  if (!annotationTemplate) return {};

  const drawingShape = resolveDrawingShape(annotationTemplate);
  const defaults = getDefaultsForShape(drawingShape);
  const configurableProps = getConfigurableProps(drawingShape);
  const annotationType = getAnnotationType(drawingShape);

  // Start with defaults for this shape
  const props = { ...defaults };

  // Overlay template values for allowed configurable props
  for (const key of configurableProps) {
    if (
      annotationTemplate[key] !== null &&
      annotationTemplate[key] !== undefined
    ) {
      props[key] = annotationTemplate[key];
    }
  }

  // Always copy certain structural keys
  for (const key of ALWAYS_COPY_KEYS) {
    if (
      annotationTemplate[key] !== null &&
      annotationTemplate[key] !== undefined
    ) {
      props[key] = annotationTemplate[key];
    }
  }

  // Set annotation type from config (may be overridden later by drawing tool)
  if (annotationType) {
    props.type = annotationType;
  }

  // Link back to template
  props.annotationTemplateId = annotationTemplate.id;

  // Carry forward drawingShape
  if (drawingShape) {
    props.drawingShape = drawingShape;
  }

  return props;
}
