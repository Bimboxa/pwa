import db from "App/db/db";
import getAnnotationTemplateIdFromAnnotation from "../utils/getAnnotationTemplateIdFromAnnotation";
import getNewAnnotationTemplateFromAnnotation from "../utils/getNewAnnotationTemplateFromAnnotation";
import testObjectHasProp from "Features/misc/utils/testObjectHasProp";

export default async function updateAnnotationService(annotation, options) {
  // options

  const label = options?.tempAnnotationTemplateLabel;
  const listingKey = options?.listingKey;

  // annotationTemplate

  const hasAnnotationTemplateId = testObjectHasProp(
    annotation,
    "annotationTemplateId"
  );
  let annotationTemplateId = annotation?.annotationTemplateId;

  if (!annotationTemplateId && hasAnnotationTemplateId) {
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
  let updates;
  if (hasAnnotationTemplateId) {
    updates = { ...annotation, annotationTemplateId };
  } else {
    updates = annotation;
  }

  await db.annotations.update(annotation.id, updates); // partial update
}
