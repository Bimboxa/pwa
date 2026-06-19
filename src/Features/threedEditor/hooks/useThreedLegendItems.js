import { useMemo } from "react";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useListings from "Features/listings/hooks/useListings";

import computeAnnotationTemplateQties from "Features/annotations/utils/computeAnnotationTemplateQties";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

/**
 * Builds the flat legend list for the 3D viewer from the exact annotation set
 * rendered in the scene (passed in by MainThreedEditor — the value returned by
 * useAutoLoadAnnotationsInThreedEditor).
 *
 * Returns a flat array mixing section headers and item rows:
 *  - { type: "listingName", name }     → listing section header
 *  - { type: "groupLabel", name }      → group header within a listing
 *  - { type: "item", id, template, label, qtyLabel } → one legend row
 *
 * @param {Array} annotations - resolved annotations shown in 3D.
 */
export default function useThreedLegendItems(annotations) {
  // data

  const annotationTemplates = useAnnotationTemplates();
  const { value: baseMaps = [] } = useBaseMaps();
  const { value: listings = [] } = useListings();

  // helpers - lookup maps

  const annotationTemplateById = useMemo(
    () => getItemsByKey(annotationTemplates, "id"),
    [annotationTemplates]
  );

  const baseMapById = useMemo(() => getItemsByKey(baseMaps, "id"), [baseMaps]);

  const listingNameById = useMemo(() => {
    const map = {};
    (listings || []).forEach((l) => {
      if (l?.id) map[l.id] = l.name || "Sans nom";
    });
    return map;
  }, [listings]);

  // main - flat legend list

  const legendItems = useMemo(() => {
    if (!annotations || annotations.length === 0) return [];

    const qtiesById = computeAnnotationTemplateQties(
      annotations,
      annotationTemplateById,
      baseMapById
    );

    // 1st-occurrence pass: one row per template, grouped by listing.
    const seen = {};
    const itemsByListingId = {};
    const listingOrder = [];

    annotations
      .filter((a) => a.type !== "IMAGE")
      .forEach((annotation) => {
        const templateId = annotation.annotationTemplateId;
        if (!templateId || seen[templateId]) return;
        const template = annotationTemplateById[templateId];
        if (!template || template.hidden || template.hiddenInLegend) return;
        seen[templateId] = true;

        const listingId = annotation.listingId ?? "__none__";
        if (!itemsByListingId[listingId]) {
          itemsByListingId[listingId] = [];
          listingOrder.push(listingId);
        }
        itemsByListingId[listingId].push({
          type: "item",
          id: templateId,
          template,
          label: (() => {
            const base =
              template.labelLegend || (template.label ?? "A définir");
            const h = Number(template.height);
            return Number.isFinite(h) && h > 0
              ? `${base} [ht. ${h.toFixed(2)} m]`
              : base;
          })(),
          qtyLabel: qtiesById[templateId]?.mainQtyLabel ?? "",
        });
      });

    // Flatten with listing + group headers (mirrors useLegendItems ordering).
    const normalize = (g) => (g ?? "").trim().toUpperCase().replace(/\s+/g, "");
    const items = [];

    listingOrder.forEach((listingId) => {
      items.push({
        type: "listingName",
        name: listingNameById[listingId] ?? "Annotations",
      });

      const sorted = itemsByListingId[listingId].sort((a, b) => {
        const gA = normalize(a.template.groupLabel);
        const gB = normalize(b.template.groupLabel);
        if (gA !== gB) {
          if (!gA) return 1;
          if (!gB) return -1;
          return gA.localeCompare(gB);
        }
        return a.label.localeCompare(b.label);
      });

      let currentGroup = null;
      sorted.forEach((item) => {
        const ng = normalize(item.template.groupLabel);
        if (ng && ng !== currentGroup) {
          items.push({
            type: "groupLabel",
            name: item.template.groupLabel?.trim(),
          });
        }
        currentGroup = ng;
        items.push(item);
      });
    });

    return items;
  }, [annotations, annotationTemplateById, baseMapById, listingNameById]);

  return legendItems;
}
