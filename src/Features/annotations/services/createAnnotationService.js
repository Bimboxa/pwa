import db from "App/db/db";

import getAnnotationTemplateIdFromAnnotation from "../utils/getAnnotationTemplateIdFromAnnotation";

export default async function createAnnotationService(annotation, options) {
  // options

  const tempAnnotationTemplateLabel = options?.tempAnnotationTemplateLabel;
  console.log("debug_2309_label", tempAnnotationTemplateLabel);

  // db
  await db.annotations.put(annotation);

  // annotation template
  if (tempAnnotationTemplateLabel) {
    await db.annotationTemplates.put({
      id: getAnnotationTemplateIdFromAnnotation(annotation),
      listingId: annotation.listingId,
      label: tempAnnotationTemplateLabel,
    });
  }

  return annotation;
}
