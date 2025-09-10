import { nanoid } from "@reduxjs/toolkit";
import getAnnotationTemplateIdFromAnnotation from "Features/annotations/utils/getAnnotationTemplateIdFromAnnotation";

export default function resolvePresetScopeEntities({ listings }) {
  const entities = [];

  for (let listing of listings) {
    if (listing.initialItems) {
      for (let item of listing.initialItems) {
        if (listing.entityModel.type === "LEGEND_ENTITY") {
          const sortedItems = item.sortedItems.map((item) => ({
            id: getAnnotationTemplateIdFromAnnotation(item),
            ...item,
          }));
          entities.push({ ...item, sortedItems, listing, id: nanoid() });
        }
      }
    }
  }

  return entities;
}
