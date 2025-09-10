import getAnnotationTemplateIdFromAnnotation from "./getAnnotationTemplateIdFromAnnotation";

export default function getFormItemFromAnnotation(annotation) {
  const annotationTemplateId =
    getAnnotationTemplateIdFromAnnotation(annotation);

  return { ...annotation, annotationTemplateId };
}
