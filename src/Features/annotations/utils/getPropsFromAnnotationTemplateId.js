export default function getPropsFromAnnotationTemplateId(annotationTemplateId) {
  if (!annotationTemplateId) return {};

  const [type, fillColor, iconKey] = annotationTemplateId.split("_");

  return { type, fillColor, iconKey };
}
