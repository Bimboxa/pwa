import { nanoid } from "@reduxjs/toolkit";
import getAnnotationTemplateIdFromAnnotation from "Features/annotations/utils/getAnnotationTemplateIdFromAnnotation";

export default function resolvePresetScopeEntities({ listings }) {
  const entities = [];

  if (!listings) return entities;

  console.log("debug_3001", listings);

  for (let listing of listings) {
    if (listing.initialItems) {
      for (let item of listing.initialItems) {
        if (listing.entityModel.type === "ANNOTATION_TEMPLATE") {
          const entity = {
            id: getAnnotationTemplateIdFromAnnotation(item),
            listingKey: listing.key,
            ...item,
          };
          entities.push({ ...entity, listing });
        }
      }
    }
  }

  return entities;
}
