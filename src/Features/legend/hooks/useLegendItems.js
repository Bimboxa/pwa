import { useSelector } from "react-redux";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotations from "Features/annotations/hooks/useAnnotations";

import useListings from "Features/listings/hooks/useListings";

import db from "App/db/db";
import { useLiveQuery } from "dexie-react-hooks";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import getAnnotationTemplateIdFromAnnotation from "Features/annotations/utils/getAnnotationTemplateIdFromAnnotation";
import getPropsFromAnnotationTemplateId from "Features/annotations/utils/getPropsFromAnnotationTemplateId";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function useLegendItems() {
  // data

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);

  const annotationTemplates = useAnnotationTemplates();
  const annotations = useAnnotations({
    filterByBaseMapId: baseMapId,
    excludeListingsIds: hiddenListingsIds,
    withListingName: true,
  });

  // helpers - annotationTemplateById

  const annotationTemplateById = getItemsByKey(annotationTemplates, "id");

  // helpers

  let legendItems = [];
  const idsMap = {};
  let legendItemsByListingName = [];

  annotations?.forEach((annotation) => {
    const templateId = annotation.annotationTemplateId;
    const template = annotationTemplateById[templateId];
    if (!idsMap[templateId]) {
      idsMap[templateId] = annotation;
      const { iconKey, fillColor, strokeColor, type, closeLine, listingName } =
        annotation;
      const newLegendItem = {
        id: templateId,
        listingName,
        type,
        iconKey,
        strokeColor,
        fillColor,
        label: template?.label ?? "A définir",
        closeLine,
      };
      //
      //legendItems.push(newLegendItem);

      //
      if (!legendItemsByListingName[listingName]) {
        legendItemsByListingName[listingName] = [newLegendItem];
      } else {
        legendItemsByListingName[listingName].push(newLegendItem);
      }
    }
  });

  // legendItemsByListingName => legendItems
  Object.entries(legendItemsByListingName).forEach(([listingName, items]) => {
    legendItems.push({ type: "listingName", name: listingName });
    const sortedItems = items.sort((a, b) => a.label.localeCompare(b.label));
    legendItems.push(...sortedItems);
  });

  // sort

  //legendItems = legendItems.sort((a, b) => a.label.localeCompare(b.label));

  // render

  return legendItems;
}
