import getAnnotationTemplateIdFromAnnotation from "./getAnnotationTemplateIdFromAnnotation";

export default function getNewAnnotationFromFormItem({
  oldAnnotation,
  newItem,
  annotationTemplates,
}) {
  let newAnnotation;

  // fill template value if changed

  const oldAnnotationTemplateId =
    getAnnotationTemplateIdFromAnnotation(oldAnnotation);
  const newAnnotationTemplateId = newItem.annotationTemplateId;

  const templateChanged = newAnnotationTemplateId !== oldAnnotationTemplateId;

  if (templateChanged && newAnnotationTemplateId) {
    const templateAnnotation = annotationTemplates?.find(
      (t) => t.id === newAnnotationTemplateId
    );
    newAnnotation = { ...newItem, ...templateAnnotation }; // pass id from templateAnnotation !
  } else {
    newAnnotation = { ...newItem };
  }

  // delete fields

  delete newAnnotation.annotationTemplateId;

  // id

  newAnnotation.id = oldAnnotation.id;

  // return

  return newAnnotation;
}
