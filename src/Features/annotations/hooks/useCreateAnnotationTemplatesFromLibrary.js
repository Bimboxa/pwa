import { nanoid } from "@reduxjs/toolkit";
import { useDispatch } from "react-redux";
import { generateKeyBetween } from "fractional-indexing";

import useCreateEntities from "Features/entities/hooks/useCreateEntities";
import useCreateAnnotationTemplate from "./useCreateAnnotationTemplate";
import { triggerAnnotationTemplatesUpdate } from "../annotationsSlice";
import getAnnotationTemplateCode from "../utils/getAnnotationTemplateCode";
import db from "App/db/db";
import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import ImageObject from "Features/images/js/ImageObject";

export default function useCreateAnnotationTemplatesFromLibrary() {
  const dispatch = useDispatch();
  const createEntities = useCreateEntities();
  const createAnnotationTemplate = useCreateAnnotationTemplate();

  return async (annotationTemplatesFromLibrary, options) => {
    console.log("[AnnotationTemplates] create from library", annotationTemplatesFromLibrary);

    const listingId = options?.listingId;
    const projectId = options?.projectId;
    const listing = { id: listingId, projectId, table: "annotationTemplates" };

    // separate templates with/without images
    const bulkItems = [];
    const templatesWithImages = [];

    // SYSTEM templates (Features/systems) reference their system listing by
    // key in the libraries: resolved to the listing of the same scope.
    const hostListing = annotationTemplatesFromLibrary.some(
      (t) => t?.systemListingKey
    )
      ? await db.listings.get(listingId)
      : null;
    const resolveSystemListing = async (template) => {
      if (!template?.systemListingKey) return template;
      const { systemListingKey, ...rest } = template;
      const systemListing = await db.listings
        .where("key")
        .equals(systemListingKey)
        .filter(
          (l) =>
            !l.deletedAt &&
            l.projectId === projectId &&
            l.scopeId === hostListing?.scopeId
        )
        .first();
      return systemListing
        ? { ...rest, systemListingId: systemListing.id }
        : rest;
    };

    let lastIndex = null;
    for (const libraryTemplate of annotationTemplatesFromLibrary) {
      const rawTemplate = await resolveSystemListing(libraryTemplate);
      const orderIndex = generateKeyBetween(lastIndex, null);
      lastIndex = orderIndex;

      if (rawTemplate.image?.imageUrlClient) {
        // templates with images need async processing — handle individually
        templatesWithImages.push({ ...rawTemplate, orderIndex });
      } else {
        // prepare template for bulk insert
        const template = {
          ...rawTemplate,
          id: nanoid(),
          projectId,
          listingId,
          orderIndex,
          code: getAnnotationTemplateCode({
            annotation: rawTemplate,
            listingKey: listingId,
          }),
        };
        bulkItems.push({ data: template, listing });
      }
    }

    // bulk insert templates without images
    if (bulkItems.length > 0) {
      await createEntities(bulkItems, { table: "annotationTemplates" });
      dispatch(triggerAnnotationTemplatesUpdate());
    }

    // handle templates with images individually (rare)
    for (const rawTemplate of templatesWithImages) {
      let annotationTemplate = { ...rawTemplate };
      const file = await imageUrlToPng({
        url: annotationTemplate.image.imageUrlClient,
        name: "image.png",
      });
      if (file) {
        const image = await ImageObject.create({ imageFile: file });
        annotationTemplate.image = image.toEntityField();
      }
      await createAnnotationTemplate(annotationTemplate, options);
    }
  };
}
