import db from "App/db/db";

import { nanoid } from "@reduxjs/toolkit";

import getAnnotationTemplateCode from "../utils/getAnnotationTemplateCode";
import getNewAnnotationTemplateFromAnnotation from "../utils/getNewAnnotationTemplateFromAnnotation";

export default async function createAnnotationService(annotation) {
  let _annotation;

  // edge case

  if (!(annotation?.annotationTemplateId || annotation?.isScaleSegment)) return;

  // main

  await db.annotations.put(annotation);

  // update listing sortedAnnotationIds
  const _listing = await db.listings.get(annotation?.listingId);
  if (_listing?.sortedAnnotationIds) {
    const updates = {
      sortedAnnotationIds: [..._listing.sortedAnnotationIds, annotation.id],
    };
    await db.listings.update(annotation.listingId, updates);
  }

  // return
  _annotation = await db.annotations.get(annotation.id);

  return _annotation;
}
