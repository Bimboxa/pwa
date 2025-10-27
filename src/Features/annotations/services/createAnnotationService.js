import db from "App/db/db";

import { nanoid } from "@reduxjs/toolkit";

import getAnnotationTemplateCode from "../utils/getAnnotationTemplateCode";
import getNewAnnotationTemplateFromAnnotation from "../utils/getNewAnnotationTemplateFromAnnotation";

export default async function createAnnotationService(annotation, options) {
  // debug

  console.log("debug_610_createAnnotationService", annotation, options);

  // options

  const tempAnnotationTemplateLabel = options?.tempAnnotationTemplateLabel;
  const listingKey = options?.listingKey;

  let _annotation;

  if (annotation?.annotationTemplateId || annotation?.isScaleSegment) {
    _annotation = await db.annotations.put(annotation);
  } else {
    //annotation template
    if (tempAnnotationTemplateLabel) {
      const code = getAnnotationTemplateCode({ annotation, listingKey });
      console.log("debug_810_code", code);

      let annotationTemplate = code
        ? await db.annotationTemplates.where("code").equals(code).first()
        : null;

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
