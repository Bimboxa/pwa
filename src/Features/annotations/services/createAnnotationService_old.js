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
    await db.annotations.put(annotation);

    // update listing sortedAnnotationIds
    const _listing = await db.listings.get(annotation?.listingId);
    if (_listing?.sortedAnnotationIds) {
      const updates = {
        sortedAnnotationIds: [..._listing.sortedAnnotationIds, annotation.id],
      };
      await db.listings.update(annotation.listingId, updates);
    }
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

      // listing
      const _listing = await db.listings.get(_annotation?.listingId);
      console.log("debug_3101_update_listing", _listing);
      if (_listing?.sortedAnnotationIds) {
        const updates = {
          sortedAnnotationIds: [...sortedAnnotationIds, _annotation.id],
        };

        await db.listings.put(_annotation.listingId, updates);
      }
    }
  }

  return _annotation;
}
