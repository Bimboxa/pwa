import getAnnotationTemplateIdFromAnnotation from "./getAnnotationTemplateIdFromAnnotation";
import getPropsFromAnnotationTemplateId from "./getPropsFromAnnotationTemplateId";

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
    // const templateAnnotation = annotationTemplates?.find(
    //   (t) => t.id === newAnnotationTemplateId
    // );
    const props = getPropsFromAnnotationTemplateId(newAnnotationTemplateId);
    newAnnotation = { ...newItem, ...props }; // pass id from templateAnnotation !
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
