import getAnnotationTemplateFromAnnotation from "./getAnnotationTemplateFromAnnotation";

export default function getFormItemFromAnnotation({
  annotation,
  annotationTemplates,
  listing,
}) {
  // main

  const annotationTemplate = getAnnotationTemplateFromAnnotation({
    annotation,
    annotationTemplates,
    listing,
  });

  console.log(
    "annotationTemplate_debug",
    annotationTemplate,
    annotationTemplates,
    listing
  );

  return { ...annotation, legendLabel: annotationTemplate?.label };
}
