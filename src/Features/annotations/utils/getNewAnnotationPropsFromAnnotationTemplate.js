export default function getNewAnnotationPropsFromAnnotationTemplate(
  annotationTemplate
) {
  const props = { ...annotationTemplate };

  delete props.id;

  props.annotationTemplateId = annotationTemplate.id;

  return props;
}
