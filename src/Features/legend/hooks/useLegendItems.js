import { useMemo, useRef } from "react";
import { useSelector } from "react-redux";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function useLegendItems() {
  // data

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  const annotationsUpdatedAt = useSelector((s) => s.annotations.annotationsUpdatedAt);

  const annotationTemplates = useAnnotationTemplates();

  const annotations = useAnnotationsV2({
    caller: "useLegendItems",
    filterByBaseMapId: baseMapId,
    excludeListingsIds: hiddenListingsIds,
    withListingName: true,
  });

  // helpers - annotationTemplateById

  const annotationTemplateById = useMemo(
    () => getItemsByKey(annotationTemplates, "id"),
    [annotationTemplates]
  );

  // memoize legend items construction — use annotationsUpdatedAt as stable dep

  const prevRef = useRef(null);
  const legendItems = useMemo(() => {
    if (!annotations || annotations.length === 0) return prevRef.current || [];

    const items = [];
    const idsMap = {};
    const legendItemsByListingName = [];

    annotations.filter(a => a.type !== "IMAGE").forEach((annotation) => {
      const templateId = annotation.annotationTemplateId;
      if (templateId) {
        const template = annotationTemplateById[templateId];
        if (!idsMap[templateId] && !template?.hidden && !template?.hiddenInLegend) {
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
    Object.entries(legendItemsByListingName).forEach(([listingName, itemsGroup]) => {
      items.push({ type: "listingName", name: listingName });
      const normalize = (g) => (g ?? "").trim().toUpperCase().replace(/\s+/g, "");
      const sortedItems = itemsGroup.sort((a, b) => {
        const gA = normalize(a.groupLabel);
        const gB = normalize(b.groupLabel);
        if (gA !== gB) {
          if (!gA) return 1;
          if (!gB) return -1;
          return gA.localeCompare(gB);
        }
        return a.label.localeCompare(b.label);
      });
      let currentGroup = null;
      for (const item of sortedItems) {
        const ng = normalize(item.groupLabel);
        if (ng && ng !== currentGroup) {
          items.push({ type: "groupLabel", name: item.groupLabel?.trim() });
        } else if (!ng && currentGroup) {
          items.push({ type: "groupDivider" });
        }
        currentGroup = ng;
        items.push(item);
      }
    });

    prevRef.current = items;
    return items;
  }, [annotationsUpdatedAt, annotationTemplateById]);

  return legendItems;
}
