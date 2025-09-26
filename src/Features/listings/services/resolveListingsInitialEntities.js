import { nanoid } from "@reduxjs/toolkit";
import getAnnotationTemplateIdFromAnnotation from "Features/annotations/utils/getAnnotationTemplateIdFromAnnotation";

export default function resolveListingsInitialEntities({ listings }) {
  const entities = [];

  for (let listing of listings) {
    if (listing.initialItems) {
      for (let item of listing.initialItems.sortedItems) {
        if (listing.entityModel.type === "ANNOTATION_TEMPLATE") {
          const entity = {
            id: getAnnotationTemplateIdFromAnnotation(item),
            listingKey: listing.key,
            listingId: listing.id,
            ...item,
          };
          entities.push(entity);
        }
      }
    }
  }

  return entities;
}
