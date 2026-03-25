import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import filterAnnotationsByViewBox from "Features/annotations/utils/filterAnnotationsByViewBox";

export default function useLegendItemsByBaseMapId(baseMapId, { viewBox, disabledAnnotationTemplates, disabledLayerIds, includeHidden } = {}) {
  // data

  const annotationTemplates = useAnnotationTemplates();

  const allAnnotations = useAnnotationsV2({
    filterByBaseMapId: baseMapId,
    filterBySelectedScope: true,
    withListingName: true,
    excludeIsForBaseMapsListings: true,
  });

  let annotations = filterAnnotationsByViewBox(allAnnotations, viewBox);

  if (disabledLayerIds?.length) {
    annotations = annotations?.filter((a) => {
      if (!a.layerId) return !disabledLayerIds.includes("__no_layer__");
      return !disabledLayerIds.includes(a.layerId);
    });
  }

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
          label: template?.labelLegend || (template?.label ?? "A définir"),
          groupLabel: template?.groupLabel,
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
    // Sort by groupLabel first (blanks last), then by label
    const normalize = (g) => (g ?? "").trim().toUpperCase().replace(/\s+/g, "");
    const sortedItems = items.sort((a, b) => {
      const gA = normalize(a.groupLabel);
      const gB = normalize(b.groupLabel);
      if (gA !== gB) {
        if (!gA) return 1;
        if (!gB) return -1;
        return gA.localeCompare(gB);
      }
      return a.label.localeCompare(b.label);
    });
    // Insert groupLabel separators and dividers
    let currentGroup = null;
    for (const item of sortedItems) {
      const ng = normalize(item.groupLabel);
      if (ng && ng !== currentGroup) {
        legendItems.push({ type: "groupLabel", name: item.groupLabel?.trim() });
      } else if (!ng && currentGroup) {
        legendItems.push({ type: "groupDivider" });
      }
      currentGroup = ng;
      legendItems.push(item);
    }
  });

  return legendItems;
}
