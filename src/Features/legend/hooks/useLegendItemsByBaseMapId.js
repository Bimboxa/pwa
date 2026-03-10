import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import filterAnnotationsByViewBox from "Features/annotations/utils/filterAnnotationsByViewBox";

export default function useLegendItemsByBaseMapId(baseMapId, { viewBox, disabledAnnotationTemplates, includeHidden } = {}) {
  // data

  const annotationTemplates = useAnnotationTemplates();

  const allAnnotations = useAnnotationsV2({
    filterByBaseMapId: baseMapId,
    filterBySelectedScope: true,
    withListingName: true,
    excludeIsForBaseMapsListings: true,
  });

  const annotations = filterAnnotationsByViewBox(allAnnotations, viewBox);

  // helpers - annotationTemplateById

  const annotationTemplateById = getItemsByKey(annotationTemplates, "id");

  // helpers

  let legendItems = [];
  const idsMap = {};
  let legendItemsByListingName = [];

  annotations?.filter(a => a.type !== "IMAGE").forEach((annotation) => {
    const templateId = annotation.annotationTemplateId;
    if (templateId) {
      const template = annotationTemplateById[templateId];
      const isTemplateHidden = template?.hidden && !includeHidden;
      const isDisabledInContainer = !includeHidden && disabledAnnotationTemplates?.includes(templateId);
      if (!idsMap[templateId] && !isTemplateHidden && !isDisabledInContainer) {
        idsMap[templateId] = annotation;
        const { iconKey, fillColor, strokeColor, type, closeLine, listingName, variant, strokeType, fillType } =
          annotation;
        const newLegendItem = {
          id: templateId,
          listingName,
          type,
          iconKey,
          strokeColor,
          strokeType,
          fillColor,
          fillType,
          label: template?.label ?? "A définir",
          closeLine,
          variant,
        };

        if (!legendItemsByListingName[listingName]) {
          legendItemsByListingName[listingName] = [newLegendItem];
        } else {
          legendItemsByListingName[listingName].push(newLegendItem);
        }
      }
    }
  });

  // legendItemsByListingName => legendItems
  Object.entries(legendItemsByListingName).forEach(([listingName, items]) => {
    legendItems.push({ type: "listingName", name: listingName });
    const sortedItems = items.sort((a, b) => a.label.localeCompare(b.label));
    legendItems.push(...sortedItems);
  });

  return legendItems;
}
