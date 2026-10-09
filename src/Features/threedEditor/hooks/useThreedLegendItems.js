import { useMemo } from "react";
import { useSelector } from "react-redux";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useListings from "Features/listings/hooks/useListings";
import useExtraBaseMapIdsIn3d from "./useExtraBaseMapIdsIn3d";
import usePaintedPartsQties from "Features/meshPaint/hooks/usePaintedPartsQties";

import computeAnnotationTemplateQties from "Features/annotations/utils/computeAnnotationTemplateQties";
import mergePaintedQtiesIntoTemplateQties from "Features/annotations/utils/mergePaintedQtiesIntoTemplateQties";
import sortAnnotationTemplatesByOrder from "Features/annotations/utils/sortAnnotationTemplatesByOrder";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import {
  getAnnotationType,
  resolveDrawingShape,
} from "Features/annotations/constants/drawingShapeConfig";
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
 * Parts painted in 3D (« Pinceau », db.meshPaints) add their m² / ml to their
 * painting template's quantity, and a template that is only painted gets a
 * row built from the template itself. Painted parts are taken with the 3D
 * scene's own rules (same partition / base maps / hidden listings and
 * templates as useAutoLoadAnnotationsInThreedEditor, host layer followed,
 * main base map dropped while its annotations are hidden, none while every
 * annotation is hidden in 3D).
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

  // painted parts — the 3D scene's scope (see useAutoLoadAnnotationsInThreedEditor)
  const isBaseMapsModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "BASE_MAPS"
  );
  const showAnnotationsInBaseMaps = useSelector(
    (s) => s.baseMapEditor.showAnnotations
  );
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  const hideAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideAnnotationsIn3d
  );
  const hideMainAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideMainBaseMapAnnotationsIn3d
  );
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const extraBaseMapIds = useExtraBaseMapIdsIn3d();
  const painted = usePaintedPartsQties({
    enabled: !hideAnnotationsIn3d,
    filterByMainBaseMap: true,
    extraBaseMapIds,
    filterBySelectedScope: true,
    excludeListingsIds: hiddenListingsIds,
    excludeIsForBaseMapsListings: !isBaseMapsModule,
    onlyIsForBaseMapsListings: isBaseMapsModule && !showAnnotationsInBaseMaps,
    excludeProfileTemplates: true,
    excludeBaseMapIds:
      hideMainAnnotationsIn3d && mainBaseMapId ? [mainBaseMapId] : null,
  });

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
    const hasAnnotations = Boolean(annotations?.length);
    if (!hasAnnotations && painted.parts.length === 0) return [];

    const qtiesById = mergePaintedQtiesIntoTemplateQties(
      hasAnnotations
        ? computeAnnotationTemplateQties(
            annotations,
            annotationTemplateById,
            baseMapById
          )
        : {},
      painted.qtiesByTemplateId,
      annotationTemplateById
    );

    // 1st-occurrence pass: one row per template, grouped by listing.
    const seen = {};
    const itemsByListingId = {};
    const listingOrder = [];

    // NodeLegendStatic-compatible row (same shape as
    // useLegendItemsByBaseMapId): visual props from the first-occurrence
    // annotation, colors falling back to the template (annotations created
    // from a template inherit colors at render time, not on the stored row).
    // This is the 3D-scoped legend, so color3D (if set) wins over the 2D
    // color for both fill and stroke — same precedence as makeMaterial.
    // `source` is the annotation, or the template itself for a template that
    // is only painted (« Pinceau » stand-in).
    const pushRow = ({ templateId, template, listingId, source }) => {
      seen[templateId] = true;
      if (!itemsByListingId[listingId]) {
        itemsByListingId[listingId] = [];
        listingOrder.push(listingId);
      }
      const color3D = source.color3D ?? template.color3D;
      itemsByListingId[listingId].push({
        id: templateId,
        // A drawingShape-only template (paint-only stand-in) carries no
        // `type`: the legend icon reads the type its shape draws.
        type: source.type ?? getAnnotationType(resolveDrawingShape(template)),
        iconKey: source.iconKey,
        fillColor: toDisplayColor(
          color3D ?? source.fillColor ?? template.fillColor
        ),
        strokeColor: toDisplayColor(
          color3D ?? source.strokeColor ?? template.strokeColor
        ),
        fillType: source.fillType,
        strokeType: source.strokeType,
        variant: source.variant,
        closeLine: source.closeLine,
        topViewDataUrl:
          template.object3D?.topViewDataUrl ?? source.object3D?.topViewDataUrl,
        groupLabel: template.groupLabel,
        label: (() => {
          const base = template.labelLegend || (template.label ?? "A définir");
          const h = Number(template.height);
          return Number.isFinite(h) && h > 0
            ? `${base} [ht. ${h.toFixed(2)} m]`
            : base;
        })(),
        qtyLabel: qtiesById[templateId]?.mainQtyLabel ?? "",
        mainQtyUnit: qtiesById[templateId]?.mainQtyUnit,
      });
    };

    (annotations ?? [])
      .filter((a) => a.type !== "IMAGE")
      .forEach((annotation) => {
        const templateId = annotation.annotationTemplateId;
        if (!templateId || seen[templateId]) return;
        const template = annotationTemplateById[templateId];
        if (!template || template.hidden || template.hiddenInLegend) return;
        pushRow({
          templateId,
          template,
          listingId: annotation.listingId ?? "__none__",
          source: annotation,
        });
      });

    // Templates only painted in the scene: row from the template.
    painted.templateIds.forEach((templateId) => {
      if (seen[templateId]) return;
      const template = annotationTemplateById[templateId];
      if (!template || template.hidden || template.hiddenInLegend) return;
      pushRow({
        templateId,
        template,
        listingId: template.listingId ?? "__none__",
        source: template,
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
    painted,
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
      if (it.id)
        map[it.id] = { mainQtyLabel: it.qtyLabel, mainQtyUnit: it.mainQtyUnit };
    });
    return map;
  }, [legendItems]);

  return { legendItems, qtiesById };
}
