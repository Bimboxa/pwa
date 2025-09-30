import getAnnotationTemplateFromAnnotation from "./getAnnotationTemplateFromAnnotation";

export default function getFormItemFromAnnotation({
  annotation,
  annotationTemplates,
  tempAnnotationTemplateLabel,
}) {
  // main

  const annotationTemplate = annotationTemplates?.find(
    (t) => t.id === annotation?.annotationTemplateId
  );

  console.log("debug_3009_annotationTemplate", annotationTemplate);

  return {
    ...annotation,
    legendLabel: annotationTemplate
      ? annotationTemplate?.label
      : tempAnnotationTemplateLabel,
  };
}
