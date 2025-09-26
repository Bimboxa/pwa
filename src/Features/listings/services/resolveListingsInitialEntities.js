import { nanoid } from "@reduxjs/toolkit";
import getAnnotationTemplateCode from "Features/annotations/utils/getAnnotationTemplateCode";
import getAnnotationTemplateIdFromAnnotation from "Features/annotations/utils/getAnnotationTemplateIdFromAnnotation";

export default function resolveListingsInitialEntities({ listings }) {
  console.log("debug_2609_listingsInitialEntities", listings);
  const entities = [];

  for (let listing of listings) {
    if (listing.initialEntities) {
      for (let item of listing.initialEntities.sortedItems) {
        if (listing.entityModel.type === "ANNOTATION_TEMPLATE") {
          const entity = {
            code: getAnnotationTemplateCode({ annotation: item, listing }),
            listingKey: listing.key,
            listing: listing,
            ...item,
          };
          entities.push(entity);
        }
      }
    }
  }

  return entities;
}
