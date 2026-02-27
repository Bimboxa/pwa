// Properties that should NOT be copied from the template to the annotation.
// These are template-level concerns and do not belong on individual annotations.
const TEMPLATE_ONLY_KEYS = [
  "id",
  "drawingShape",
  "drawingColor",
  "drawingOpacity",
  "drawingTools",
  "hidden",
  "mainQtyKey",
  "code",
  "createdAt",
  "updatedAt",
  "createdBy",
  "createdByUserIdMaster",
  "deletedAt",
];

export default function getNewAnnotationPropsFromAnnotationTemplate(
  annotationTemplate
) {
  if (!annotationTemplate) return {};

  const props = {};

  for (const [key, value] of Object.entries(annotationTemplate)) {
    if (!TEMPLATE_ONLY_KEYS.includes(key)) {
      props[key] = value;
    }
  }

  props.annotationTemplateId = annotationTemplate.id;

  return props;
}
