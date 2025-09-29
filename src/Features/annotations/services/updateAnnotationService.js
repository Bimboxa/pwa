import db from "App/db/db";
import getAnnotationTemplateIdFromAnnotation from "../utils/getAnnotationTemplateIdFromAnnotation";
import getNewAnnotationTemplateFromAnnotation from "../utils/getNewAnnotationTemplateFromAnnotation";

export default async function updateAnnotationService(annotation, options) {
  // options

  const label = options?.tempAnnotationTemplateLabel;
  const listingKey = options?.listingKey;

  // annotationTemplate

  let annotationTemplateId = annotation?.annotationTemplateId;

  if (!annotationTemplateId) {
    const at = getNewAnnotationTemplateFromAnnotation({
      annotation,
      listingKey,
      label,
    });
    await db.annotationTemplates.put(at);
    annotationTemplateId = at.id;
  } else if (annotationTemplateId && label) {
    await db.annotationTemplates.update(annotationTemplateId, { label });
  }

  // main

  await db.annotations.update(annotation.id, {
    ...annotation,
    annotationTemplateId,
  }); // partial update
}
