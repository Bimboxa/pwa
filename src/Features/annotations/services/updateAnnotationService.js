import db from "App/db/db";
import getAnnotationTemplateIdFromAnnotation from "../utils/getAnnotationTemplateIdFromAnnotation";

export default async function updateAnnotationService(annotation, options) {
  // options

  const tempAnnotationTemplateLabel = options?.tempAnnotationTemplateLabel;
  console.log("tempAnnotationTemplateLabel", tempAnnotationTemplateLabel);

  // main

  await db.annotations.update(annotation.id, { ...annotation }); // partial update

  if (tempAnnotationTemplateLabel) {
    const template = {
      id: getAnnotationTemplateIdFromAnnotation(annotation),
      listingId: annotation.listingId,
      label: tempAnnotationTemplateLabel,
    };
    db.annotationTemplates.put(template);
  }
}
