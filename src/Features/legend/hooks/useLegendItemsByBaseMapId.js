import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import filterAnnotationsByViewBox from "Features/annotations/utils/filterAnnotationsByViewBox";

export default function useLegendItemsByBaseMapId(baseMapId, { viewBox, disabledAnnotationTemplates, disabledLayerIds, includeHidden } = {}) {
  // data

  const annotationTemplates = useAnnotationTemplates({ sortByOrder: true });

  const allAnnotations = useAnnotationsV2({
    caller: "useLegendItemsByBaseMapId",
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
      const isHiddenInLegend = template?.hiddenInLegend && !includeHidden;
      const isDisabledInContainer = !includeHidden && disabledAnnotationTemplates?.includes(templateId);
      if (!idsMap[templateId] && !isTemplateHidden && !isHiddenInLegend && !isDisabledInContainer) {
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
          label: (() => {
            const base = template?.labelLegend || (template?.label ?? "A définir");
            return template?.height > 0
              ? `${base} [ht. ${template.height.toFixed(2)} m]`
              : base;
          })(),
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
  const orderMap = {};
  annotationTemplates?.forEach((t, i) => { orderMap[t.id] = i; });
  const normalize = (g) => (g ?? "").trim().toUpperCase().replace(/\s+/g, "");
  Object.entries(legendItemsByListingName).forEach(([listingName, items]) => {
    legendItems.push({ type: "listingName", name: listingName });
    // Sort by annotationTemplate orderIndex (same order as PopperMapListings)
    const sortedItems = items.sort((a, b) => {
      const oA = orderMap[a.id] ?? Infinity;
      const oB = orderMap[b.id] ?? Infinity;
      return oA - oB;
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
