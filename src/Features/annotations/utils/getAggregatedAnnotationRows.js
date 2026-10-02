/**
 * Aggregates enriched annotations into datagrid/export rows.
 *
 * Two modes:
 * - global (splitByContext: false): one row per annotation template.
 * - split (splitByContext: true): one row per template × layer × baseMap × height.
 *
 * Rows are ordered by template rank (listing order in the scope, then template
 * orderIndex within the listing), then — in split mode — by baseMap name,
 * layer name and height.
 *
 * Mesh cells (isMeshCell) are skipped: their parent annotation already carries
 * the quantities (avoid double-count).
 *
 * Painted parts (« Pinceau » 3D, resolvePaintedParts output) are processed
 * AFTER the annotations: in global mode a counted part joins its painting
 * template's row (or creates it from the template), adding its length /
 * surface and `paintedCount` without touching `unit` or the heights; in split
 * mode the parts of a template × layer × baseMap get their own row
 * (`…|PAINT`, unit 0, no height). Uncounted parts (orphans, conflicts) are
 * skipped. Every row carries `paintedCount`.
 *
 * @param {Object} params
 * @param {Array} params.annotations - enriched annotations (listingName, baseMapName, layerName, height, qties…)
 * @param {Array} [params.paintedParts] - painted parts (template, listingName, baseMapName, layerName, isCounted, length, surface…)
 * @param {boolean} params.splitByContext - false = global aggregation, true = split by layer/baseMap/height
 * @param {Map<string, number>} params.templateRankById - template order (see useTemplateRankById)
 * @returns {Array} rows
 */
export default function getAggregatedAnnotationRows({
  annotations,
  paintedParts = [],
  splitByContext,
  templateRankById,
}) {
  if (!annotations && !paintedParts?.length) return [];

  const getHeightKey = (height) =>
    height === null || height === undefined
      ? "null"
      : Number(height).toFixed(3);

  const grouped = {};

  for (const annotation of annotations ?? []) {
    const templateId = annotation.annotationTemplateId;
    if (!templateId) continue;
    if (annotation.isMeshCell) continue;

    const heightKey = getHeightKey(annotation.height);
    const groupKey = splitByContext
      ? `${templateId}|${annotation.layerId ?? "null"}|${
          annotation.baseMapId ?? "null"
        }|${heightKey}`
      : templateId;

    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        id: groupKey,
        templateId,
        templateLabel:
          annotation.annotationTemplateProps?.label || "Sans Label",
        listingNames: new Set(),
        baseMapNames: new Set(),
        layerNames: new Set(),
        heightKeys: new Set(),
        height: annotation.height ?? null,
        unit: 0,
        length: 0,
        surface: 0,
        paintedCount: 0,
        // Template visual props (from first annotation in group)
        type: annotation.type,
        fillColor: annotation.fillColor,
        strokeColor: annotation.strokeColor,
        fillOpacity: annotation.fillOpacity,
        strokeOpacity: annotation.strokeOpacity,
        fillType: annotation.fillType,
        variant: annotation.variant,
        iconKey: annotation.iconKey,
        image: annotation.image,
      };
    }

    const row = grouped[groupKey];
    row.unit += 1;
    row.heightKeys.add(heightKey);
    if (annotation.listingName) row.listingNames.add(annotation.listingName);
    if (annotation.baseMapName) row.baseMapNames.add(annotation.baseMapName);
    if (annotation.layerName) row.layerNames.add(annotation.layerName);

    if (annotation.qties?.enabled) {
      if (Number.isFinite(annotation.qties.length))
        row.length += annotation.qties.length;
      if (Number.isFinite(annotation.qties.surface))
        row.surface += annotation.qties.surface;
    }
  }

  // painted parts — after the annotations, so a template drawn AND painted
  // keeps the visual props / heights of its annotations
  for (const part of paintedParts ?? []) {
    const templateId = part?.annotationTemplateId;
    if (!templateId || !part.isCounted) continue;

    const groupKey = splitByContext
      ? `${templateId}|${part.layerId ?? "null"}|${part.baseMapId ?? "null"}|PAINT`
      : templateId;

    if (!grouped[groupKey]) {
      const template = part.template ?? {};
      grouped[groupKey] = {
        id: groupKey,
        templateId,
        templateLabel: template.label || "Sans Label",
        listingNames: new Set(),
        baseMapNames: new Set(),
        layerNames: new Set(),
        heightKeys: new Set(),
        height: null,
        unit: 0,
        length: 0,
        surface: 0,
        paintedCount: 0,
        // Template visual props (no annotation in the group); drawingShape:
        // a drawingShape-only template has no `type` (icon resolver).
        type: template.type,
        drawingShape: template.drawingShape,
        fillColor: template.fillColor,
        strokeColor: template.strokeColor,
        fillOpacity: template.fillOpacity,
        strokeOpacity: template.strokeOpacity,
        fillType: template.fillType,
        variant: template.variant,
        iconKey: template.iconKey,
        image: template.image,
      };
    }

    const row = grouped[groupKey];
    row.paintedCount += 1;
    if (part.listingName) row.listingNames.add(part.listingName);
    if (part.baseMapName) row.baseMapNames.add(part.baseMapName);
    if (part.layerName) row.layerNames.add(part.layerName);
    if (part.qtiesEnabled !== false) {
      if (Number.isFinite(part.length)) row.length += part.length;
      if (Number.isFinite(part.surface)) row.surface += part.surface;
    }
  }

  const rows = Object.values(grouped).map((row) => {
    const { heightKeys, listingNames, baseMapNames, layerNames, ...rest } = row;
    const hasMultipleHeights = heightKeys.size > 1;
    return {
      ...rest,
      hasMultipleHeights,
      height: hasMultipleHeights ? null : rest.height,
      listingName: [...listingNames].join(", "),
      baseMapName: [...baseMapNames].join(", "),
      layerName: [...layerNames].join(", "),
    };
  });

  // sort: template rank, then baseMap / layer / height (split mode tie-breakers)
  rows.sort((a, b) => {
    const rankA = templateRankById?.get(a.templateId) ?? Infinity;
    const rankB = templateRankById?.get(b.templateId) ?? Infinity;
    if (rankA !== rankB) return rankA - rankB;
    const byBaseMap = a.baseMapName.localeCompare(b.baseMapName);
    if (byBaseMap !== 0) return byBaseMap;
    const byLayer = a.layerName.localeCompare(b.layerName);
    if (byLayer !== 0) return byLayer;
    const heightA = a.height ?? Infinity;
    const heightB = b.height ?? Infinity;
    return heightA - heightB;
  });

  return rows;
}
