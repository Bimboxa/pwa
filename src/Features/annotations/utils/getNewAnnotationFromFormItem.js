import getAnnotationTemplateFromAnnotation from "./getAnnotationTemplateFromAnnotation";
import getAnnotationTemplateIdFromAnnotation from "./getAnnotationTemplateIdFromAnnotation";
import getPropsFromAnnotationTemplateId from "./getPropsFromAnnotationTemplateId";

export default function getNewAnnotationFromFormItem({
  oldAnnotation,
  newItem,
  annotationTemplates,
  listing,
}) {
  let newAnnotation;

  // fill template value if changed

  const newAnnotationTemplate = getAnnotationTemplateFromAnnotation({
    annotation: newItem,
    listing,
    annotationTemplates,
  });

  const templateChanged =
    newAnnotationTemplate?.id !== oldAnnotation?.annotationTemplateId;

  if (templateChanged) {
    // const templateAnnotation = annotationTemplates?.find(
    //   (t) => t.id === newAnnotationTemplateId
    // );
    //const props = getPropsFromAnnotationTemplateId(newAnnotationTemplateId);
    newAnnotation = {
      ...newItem,
      annotationTemplateId: newAnnotationTemplate?.id,
    }; // pass id from templateAnnotation !
  } else {
    newAnnotation = { ...newItem };
  }

  // id

  newAnnotation.id = oldAnnotation.id;

  // return

  return newAnnotation;
}
