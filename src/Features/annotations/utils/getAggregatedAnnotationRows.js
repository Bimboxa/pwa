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
 * @param {Object} params
 * @param {Array} params.annotations - enriched annotations (listingName, baseMapName, layerName, height, qties…)
 * @param {boolean} params.splitByContext - false = global aggregation, true = split by layer/baseMap/height
 * @param {Map<string, number>} params.templateRankById - template order (see useTemplateRankById)
 * @returns {Array} rows
 */
export default function getAggregatedAnnotationRows({
  annotations,
  splitByContext,
  templateRankById,
}) {
  if (!annotations) return [];

  const getHeightKey = (height) =>
    height === null || height === undefined
      ? "null"
      : Number(height).toFixed(3);

  const grouped = {};

  for (const annotation of annotations) {
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
