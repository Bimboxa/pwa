import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getLegendGroupHeaders, {
  normalizeLegendGroupLabel,
} from "Features/legend/utils/getLegendGroupHeaders";
import isComponentTemplate from "Features/annotationComponents/utils/isComponentTemplate";
import { getOffsetLineLegendProps } from "Features/annotations/utils/getAnnotationOffsetLineConfig";
import filterAnnotationsByViewBox from "Features/annotations/utils/filterAnnotationsByViewBox";

// includeHiddenInLegend: keep the templates flagged `hiddenInLegend` (tagged
// `hiddenInLegend: true` on their item) without the eye-hidden ones — used by
// the capture legend editor, which lists them so they can be re-enabled.
export default function useLegendItemsByBaseMapId(baseMapId, { viewBox, disabledAnnotationTemplates, disabledLayerIds, hiddenAnnotationIdSet, includeHidden, includeHiddenInLegend = false, hideHeight = false } = {}) {
  // data

  const annotationTemplates = useAnnotationTemplates({ sortByOrder: true });

  const allAnnotations = useAnnotationsV2({
    caller: "useLegendItemsByBaseMapId",
    filterByBaseMapId: baseMapId,
    filterBySelectedScope: true,
    withListingName: true,
    sortByOrderIndex: true,
  });

  let annotations = filterAnnotationsByViewBox(allAnnotations, viewBox);

  // annotations left out by the caller (e.g. not in the phase of a portfolio
  // container)
  if (hiddenAnnotationIdSet?.size) {
    annotations = annotations?.filter((a) => !hiddenAnnotationIdSet.has(a.id));
  }

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
      // A « Composant » stands in the legend through the templates it
      // generates, never through its own row.
      if (isComponentTemplate(template)) return;
      const isTemplateHidden = template?.hidden && !includeHidden;
      const isHiddenInLegend =
        template?.hiddenInLegend && !includeHidden && !includeHiddenInLegend;
      const isDisabledInContainer = !includeHidden && disabledAnnotationTemplates?.includes(templateId);
      if (!idsMap[templateId] && !isTemplateHidden && !isHiddenInLegend && !isDisabledInContainer) {
        idsMap[templateId] = annotation;
        const { iconKey, type, closeLine, listingName, variant, strokeType, fillType } =
          annotation;
        // Fall back to template colors when the annotation itself doesn't
        // carry an explicit color override (annotations created from a
        // template inherit colors at render time, not on the stored row).
        const fillColor = annotation.fillColor ?? template?.fillColor;
        const strokeColor = annotation.strokeColor ?? template?.strokeColor;
        const newLegendItem = {
          id: templateId,
          listingName,
          type,
          iconKey,
          strokeColor,
          strokeType: strokeType ?? template?.strokeType,
          // POLYLINE glyph: thickness (when in screen px) of the line.
          strokeWidth: annotation.strokeWidth ?? template?.strokeWidth,
          strokeWidthUnit: annotation.strokeWidthUnit ?? template?.strokeWidthUnit,
          fillColor,
          fillType,
          // "Ligne de déport" drawn: the glyph is that line.
          offsetLine: getOffsetLineLegendProps(annotation, template),
          topViewDataUrl:
            template?.object3D?.topViewDataUrl ??
            annotation.object3D?.topViewDataUrl,
          color2D:
            template?.color2DEnabled && template?.color2D
              ? template.color2D
              : null,
          label: (() => {
            const base = template?.labelLegend || (template?.label ?? "A définir");
            // height may have been persisted as a string by older builds
            const height = Number(template?.height);
            return !hideHeight && Number.isFinite(height) && height > 0
              ? `${base} [ht. ${height.toFixed(2)} m]`
              : base;
          })(),
          groupLabel: template?.groupLabel,
          groupLabelLegend: template?.groupLabelLegend,
          groupLabelHiddenInLegend: Boolean(template?.groupLabelHiddenInLegend),
          closeLine,
          variant,
          hiddenInLegend: Boolean(template?.hiddenInLegend),
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
  const normalize = normalizeLegendGroupLabel;
  Object.entries(legendItemsByListingName).forEach(([listingName, items]) => {
    legendItems.push({ type: "listingName", name: listingName });
    // Sort by annotationTemplate orderIndex (same order as PopperMapListings)
    const sortedItems = items.sort((a, b) => {
      const oA = orderMap[a.id] ?? Infinity;
      const oB = orderMap[b.id] ?? Infinity;
      return oA - oB;
    });
    // Insert groupLabel separators and dividers
    const groupHeaders = getLegendGroupHeaders(items);
    let currentGroup = null;
    for (const item of sortedItems) {
      const ng = normalize(item.groupLabel);
      if (ng && ng !== currentGroup) {
        // A header hidden in the legend is kept (tagged) for the capture
        // legend editor only; elsewhere a divider keeps the group apart.
        const header = groupHeaders[ng];
        if (!header.hidden || includeHidden || includeHiddenInLegend)
          legendItems.push({
            type: "groupLabel",
            name: header.name,
            hiddenInLegend: header.hidden,
          });
        else if (currentGroup !== null)
          legendItems.push({ type: "groupDivider" });
      } else if (!ng && currentGroup) {
        legendItems.push({ type: "groupDivider" });
      }
      currentGroup = ng;
      legendItems.push(item);
    }
  });

  return legendItems;
}
