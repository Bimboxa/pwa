import db from "App/db/db";

import { nanoid } from "@reduxjs/toolkit";

import getAnnotationTemplateCode from "../utils/getAnnotationTemplateCode";

export default async function createAnnotationService(annotation, options) {
  // options

  const updateAnnotationTemplateId = options.updateAnnotationTemplateId;
  const tempAnnotationTemplateLabel = options?.tempAnnotationTemplateLabel;
  const listingKey = options?.listingKey;

  let _annotation;

  if (!updateAnnotationTemplateId) {
    _annotation = await db.annotations.put(annotation);
  } else {
    //annotation template
    if (tempAnnotationTemplateLabel) {
      const code = getAnnotationTemplateCode({ annotation, listingKey });

      let annotationTemplate = await db.annotationTemplates
        .where("code")
        .equals(code)
        .first();

      if (!annotationTemplate) {
        annotationTemplate = {
          id: nanoid(),
          code,
          projectId: annotation.projectId,
          listingId: annotation.listingId,
          label: tempAnnotationTemplateLabel,
          type: annotation.type,
          fillColor: annotation.fillColor,
          iconKey: annotation.iconKey,
          isFromAnnotation: true,
        };
        await db.annotationTemplates.put(annotationTemplate);
      }

      // db
      _annotation = await db.annotations.put({
        ...annotation,
        annotationTemplateId: annotationTemplate?.id,
      });
    }
  }

  return _annotation;
}
