import { useMemo } from "react";

import useAnnotationTemplates from "./useAnnotationTemplates";
import useAnnotationsV2 from "./useAnnotationsV2";
import useBaseMap from "Features/baseMaps/hooks/useBaseMap";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationTemplateMainQtyLabel from "Features/annotations/utils/getAnnotationTemplateMainQtyLabel";
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";
import filterAnnotationsByViewBox from "Features/annotations/utils/filterAnnotationsByViewBox";

export default function useAnnotationTemplateQtiesByIdForBaseMap(baseMapId, { viewBox } = {}) {
  // data

  const allAnnotations = useAnnotationsV2({ filterByBaseMapId: baseMapId, filterBySelectedScope: true });
  const annotations = filterAnnotationsByViewBox(allAnnotations, viewBox);
  const annotationTemplates = useAnnotationTemplates();
  const baseMap = useBaseMap({ id: baseMapId });

  // helpers

  const annotationTemplateById = useMemo(
    () => getItemsByKey(annotationTemplates ?? [], "id"),
    [annotationTemplates]
  );

  // main calculation

  return useMemo(() => {
    if (!annotations) return {};

    const meterByPx = baseMap?.getMeterByPx();

    const qtiesById = annotations.reduce((acc, annotation) => {
      const templateId = annotation?.annotationTemplateId;
      if (!templateId) return acc;

      if (!acc[templateId]) {
        acc[templateId] = {
          count: 0,
          length: 0,
          surface: 0,
          unit: 0,
          mainQtyLabel: "-",
        };
      }

      const stats = acc[templateId];
      stats.count += 1;
      stats.unit = stats.count;

      const qty = getAnnotationQties({ annotation, meterByPx });

      if (qty && qty.enabled) {
        if (Number.isFinite(qty.length)) {
          stats.length += qty.length;
        }
        if (Number.isFinite(qty.surface)) {
          stats.surface += qty.surface;
        }
      }

      return acc;
    }, {});

    Object.entries(qtiesById).forEach(([templateId, stats]) => {
      const template = annotationTemplateById?.[templateId];
      if (!template) {
        stats.mainQtyLabel = `${stats.unit ?? "-"} u`;
        return;
      }
      stats.mainQtyLabel = getAnnotationTemplateMainQtyLabel(template, stats);
    });

    return qtiesById;
  }, [annotations, baseMap, annotationTemplateById]);
}
