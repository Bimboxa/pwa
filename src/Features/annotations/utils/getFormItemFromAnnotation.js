import getAnnotationTemplateIdFromAnnotation from "./getAnnotationTemplateIdFromAnnotation";

export default function getFormItemFromAnnotation(annotation) {
  // main

  const annotationTemplateId =
    getAnnotationTemplateIdFromAnnotation(annotation);

  return { ...annotation, annotationTemplateId };
}
