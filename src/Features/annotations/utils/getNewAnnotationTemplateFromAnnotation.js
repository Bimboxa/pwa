import { nanoid } from "@reduxjs/toolkit";
import getAnnotationTemplateCode from "./getAnnotationTemplateCode";
export default function getNewAnnotationTemplateFromAnnotation({
  annotation,
  label,
  listingKey,
}) {
  const code = getAnnotationTemplateCode({ annotation, listingKey });
  const annotationTemplate = {
    id: nanoid(),
    code,
    projectId: annotation.projectId,
    listingId: annotation.listingId,
    label,
    type: annotation.type,
    fillColor: annotation.fillColor,
    strokeColor: annotation.strokeColor,
    iconKey: annotation.iconKey,
    isFromAnnotation: true,
  };

  console.log("debug_1310_newAnnotationTemplate", annotationTemplate);

  return annotationTemplate;
}
