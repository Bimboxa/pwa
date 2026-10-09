import { useMemo } from "react";

import useAnnotationTemplates from "./useAnnotationTemplates";
import useAnnotationsV2 from "./useAnnotationsV2";
import useBaseMap from "Features/baseMaps/hooks/useBaseMap";
import usePaintedPartsQties from "Features/meshPaint/hooks/usePaintedPartsQties";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationTemplateMainQtyLabel, {
  getAnnotationTemplateMainQtyUnit,
} from "Features/annotations/utils/getAnnotationTemplateMainQtyLabel";
import mergePaintedQtiesIntoTemplateQties from "Features/annotations/utils/mergePaintedQtiesIntoTemplateQties";
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";
import filterAnnotationsByViewBox from "Features/annotations/utils/filterAnnotationsByViewBox";

export default function useAnnotationTemplateQtiesByIdForBaseMap(baseMapId, { viewBox, disabledAnnotationTemplates, disabledLayerIds } = {}) {
  // data

  const allAnnotations = useAnnotationsV2({ caller: "useAnnotationTemplateQtiesByIdForBaseMap", filterByBaseMapId: baseMapId, filterBySelectedScope: true, excludeIsForBaseMapsListings: true, withQties: true });
  let annotations = filterAnnotationsByViewBox(allAnnotations, viewBox);

  if (disabledAnnotationTemplates?.length) {
    annotations = annotations?.filter(
      (a) => !disabledAnnotationTemplates.includes(a.annotationTemplateId)
    );
  }
  if (disabledLayerIds?.length) {
    annotations = annotations?.filter((a) => {
      if (!a.layerId) return !disabledLayerIds.includes("__no_layer__");
      return !disabledLayerIds.includes(a.layerId);
    });
  }
  const annotationTemplates = useAnnotationTemplates();
  const baseMap = useBaseMap({ id: baseMapId });
  // Parts painted in 3D (« Pinceau ») on this base map: same scope (selected
  // scope, view box, disabled templates / host layers, hidden painting
  // templates dropped), added to their painting template's totals.
  const painted = usePaintedPartsQties({
    enabled: Boolean(baseMapId),
    filterByBaseMapId: baseMapId,
    filterBySelectedScope: true,
    excludeIsForBaseMapsListings: true,
    viewBox,
    disabledAnnotationTemplates,
    disabledLayerIds,
    annotationTemplates,
  });

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
      // Mesh cells are children already represented by their parent — skip.
      if (annotation?.isMeshCell) return acc;

      if (!acc[templateId]) {
        acc[templateId] = {
          count: 0,
          length: 0,
          surface: 0,
          unit: 0,
          mesh3dCount: 0,
          mainQtyLabel: "-",
        };
      }

      const stats = acc[templateId];
      stats.count += 1;
      stats.unit = stats.count;
      if (annotation.isMesh3d) stats.mesh3dCount += 1;

      const qty = annotation.qties ?? getAnnotationQties({ annotation, meterByPx });

      if (qty && qty.enabled) {
        const length = qty.lengthDeveloped != null ? qty.lengthDeveloped : qty.length;
        const surface = qty.surfaceDeveloped != null ? qty.surfaceDeveloped : qty.surface;
        if (Number.isFinite(length)) {
          stats.length += length;
        }
        if (Number.isFinite(surface)) {
          stats.surface += surface;
        }
      }

      return acc;
    }, {});

    Object.entries(qtiesById).forEach(([templateId, stats]) => {
      // A mesh 3D annotation voids the template's surface / length total
      // (only the unit count stays) — same rule as computeAnnotationTemplateQties.
      if (stats.mesh3dCount > 0) {
        stats.length = null;
        stats.surface = null;
      }
      const template = annotationTemplateById?.[templateId];
      if (!template) {
        stats.mainQtyLabel = `${stats.unit ?? "-"} u`;
        stats.mainQtyUnit = "u";
        return;
      }
      stats.mainQtyLabel = getAnnotationTemplateMainQtyLabel(template, stats);
      stats.mainQtyUnit = getAnnotationTemplateMainQtyUnit(template);
    });

    return mergePaintedQtiesIntoTemplateQties(
      qtiesById,
      painted.qtiesByTemplateId,
      annotationTemplateById
    );
  }, [annotations, baseMap, annotationTemplateById, painted]);
}
