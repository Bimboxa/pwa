/*
 * props => {annotationTemplateId, fillColor, iconKey}
 */

import getAnnotationTemplateFromAnnotation from "./getAnnotationTemplateFromAnnotation";

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
    newAnnotation = {
      ...newItem,
      annotationTemplateId: newAnnotationTemplate?.id,
    };
  } else {
    newAnnotation = { ...newItem };
  }

  // id

  newAnnotation.id = oldAnnotation.id;

  // return

  return newAnnotation;
}
