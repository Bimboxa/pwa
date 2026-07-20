import { useMemo } from "react";
import { useSelector } from "react-redux";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useListings from "Features/listings/hooks/useListings";

import computeAnnotationTemplateQties from "Features/annotations/utils/computeAnnotationTemplateQties";
import sortAnnotationTemplatesByOrder from "Features/annotations/utils/sortAnnotationTemplatesByOrder";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import { toWatercolorHexColor } from "Features/threedEditor/js/postfx/aquarelleMaterials";

/**
 * Builds the flat legend list for the 3D viewer from the exact annotation set
 * rendered in the scene (passed in by MainThreedEditor — the value returned by
 * useAutoLoadAnnotationsInThreedEditor).
 *
 * Returns { legendItems, qtiesById }:
 *  - legendItems: flat array mixing section headers and item rows, in the
 *    shape consumed by NodeLegendStatic (same as useLegendItemsByBaseMapId):
 *      - { type: "listingName", name }  → listing section header
 *      - { type: "groupLabel", name }   → group header within a listing
 *      - { id, type, iconKey, fillColor, strokeColor, fillType, strokeType,
 *          variant, closeLine, label, groupLabel } → one legend row
 *  - qtiesById: { [templateId]: { mainQtyLabel } } for the qty column.
 *
 * @param {Array} annotations - resolved annotations shown in 3D.
 */
export default function useThreedLegendItems(annotations) {
  // data

  const annotationTemplates = useAnnotationTemplates();
  const { value: baseMaps = [] } = useBaseMaps();
  const { value: listings = [] } = useListings();

  // AQUARELLE renders every object with a watercolor-shifted color — the
  // legend icons must show the same wash, not the raw template color. Other
  // modes keep colors close to native, so no transform is needed there.
  const renderMode = useSelector((s) => s.threedEditor.renderMode);
  const toDisplayColor = useMemo(
    () => (renderMode === "AQUARELLE" ? toWatercolorHexColor : (c) => c),
    [renderMode]
  );

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

  // Per-template rank reproducing the PopperMapListings order: within each
  // listing, templates are sorted via sortAnnotationTemplatesByOrder
  // (orderIndex + group consolidation) — same util PopperMapListings relies on.
  const orderRankByTemplateId = useMemo(() => {
    const templatesByListingId = {};
    (annotationTemplates || []).forEach((t) => {
      const listingId = t?.listingId ?? "__none__";
      if (!templatesByListingId[listingId])
        templatesByListingId[listingId] = [];
      templatesByListingId[listingId].push(t);
    });

    const rank = {};
    Object.values(templatesByListingId).forEach((templates) => {
      sortAnnotationTemplatesByOrder(templates).forEach((t, index) => {
        if (t?.id != null) rank[t.id] = index;
      });
    });
    return rank;
  }, [annotationTemplates]);

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
        // NodeLegendStatic-compatible row (same shape as
        // useLegendItemsByBaseMapId): visual props from the first-occurrence
        // annotation, colors falling back to the template (annotations created
        // from a template inherit colors at render time, not on the stored row).
        itemsByListingId[listingId].push({
          id: templateId,
          type: annotation.type,
          iconKey: annotation.iconKey,
          fillColor: toDisplayColor(annotation.fillColor ?? template.fillColor),
          strokeColor: toDisplayColor(
            annotation.strokeColor ?? template.strokeColor
          ),
          fillType: annotation.fillType,
          strokeType: annotation.strokeType,
          variant: annotation.variant,
          closeLine: annotation.closeLine,
          topViewDataUrl:
            template.object3D?.topViewDataUrl ??
            annotation.object3D?.topViewDataUrl,
          groupLabel: template.groupLabel,
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
        const rA = orderRankByTemplateId[a.id];
        const rB = orderRankByTemplateId[b.id];
        const hasA = rA != null;
        const hasB = rB != null;
        if (hasA && hasB) return rA - rB;
        if (hasA) return -1; // ranked items first, unranked last
        if (hasB) return 1;
        return a.label.localeCompare(b.label);
      });

      let currentGroup = null;
      sorted.forEach((item) => {
        const ng = normalize(item.groupLabel);
        if (ng && ng !== currentGroup) {
          items.push({
            type: "groupLabel",
            name: item.groupLabel?.trim(),
          });
        }
        currentGroup = ng;
        items.push(item);
      });
    });

    return items;
  }, [
    annotations,
    annotationTemplateById,
    baseMapById,
    listingNameById,
    orderRankByTemplateId,
    toDisplayColor,
  ]);

  // qty lookup in the shape NodeLegendStatic reads (qtiesById[id].mainQtyLabel)
  const qtiesById = useMemo(() => {
    const map = {};
    legendItems.forEach((it) => {
      if (it.id) map[it.id] = { mainQtyLabel: it.qtyLabel };
    });
    return map;
  }, [legendItems]);

  return { legendItems, qtiesById };
}
