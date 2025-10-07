import db from "App/db/db";

import { nanoid } from "@reduxjs/toolkit";

import getAnnotationTemplateCode from "../utils/getAnnotationTemplateCode";
import getNewAnnotationTemplateFromAnnotation from "../utils/getNewAnnotationTemplateFromAnnotation";

export default async function createAnnotationService(annotation, options) {
  // debug

  console.log("debug_610_createAnnotationService", annotation, options);

  // options

  const updateAnnotationTemplateId = options?.updateAnnotationTemplateId;
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
        annotationTemplate = getNewAnnotationTemplateFromAnnotation({
          annotation,
          label: tempAnnotationTemplateLabel,
          listingKey,
        });
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
