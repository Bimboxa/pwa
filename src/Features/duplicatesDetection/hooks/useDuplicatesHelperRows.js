import { useMemo } from "react";

import createAnnotationLabeler from "../utils/createAnnotationLabeler";

const EMPTY = { rows: [], missingCount: 0 };
const NO_LAYER_S = "sans calque";

// Joins the duplicates of the last run with the helper's live annotations /
// templates into display rows: label (own label, else « Modèle 03 » numbered
// in the template's draw order like the Dessin panel), the template (icon),
// overlap text in m / m² (calibrated run) or px / px². Annotations deleted since the run are
// counted in `missingCount` instead of rendered. `layerText` is only set when
// one of the row's partners sits on another layer (« sans calque » if none).
export default function useDuplicatesHelperRows({
  result,
  annotations,
  templateById,
  layerById,
  meterByPx,
  hasScale,
}) {
  return useMemo(() => {
    const duplicates = result?.duplicates ?? [];
    if (!duplicates.length) return EMPTY;

    const { byId, getLabel } = createAnnotationLabeler(
      annotations,
      templateById
    );

    const layerIdByAnnotationId = new Map();
    for (const dup of duplicates) {
      layerIdByAnnotationId.set(dup.annotationId, dup.layerId ?? null);
    }

    const rows = [];
    let missingCount = 0;
    for (const dup of duplicates) {
      const annotation = byId.get(dup.annotationId);
      if (!annotation) {
        missingCount += 1;
        continue;
      }
      const template = templateById?.[annotation.annotationTemplateId];
      const label = getLabel(annotation);
      const isArea = dup.measure === "AREA";
      const overlapText =
        hasScale && meterByPx
          ? isArea
            ? `${(dup.overlapPx * meterByPx * meterByPx).toFixed(2)} m²`
            : `${(dup.overlapPx * meterByPx).toFixed(2)} m`
          : `${Math.round(dup.overlapPx)} px${isArea ? "²" : ""}`;
      const layerId = annotation.layerId ?? null;
      const hasOtherLayerPartner = (dup.partnerIds ?? []).some(
        (id) =>
          layerIdByAnnotationId.has(id) &&
          layerIdByAnnotationId.get(id) !== layerId
      );
      const layerText = hasOtherLayerPartner
        ? layerId && layerById?.[layerId]?.name
          ? `calque ${layerById[layerId].name}`
          : NO_LAYER_S
        : null;
      rows.push({
        ...dup,
        annotation,
        template,
        label,
        overlapText,
        layerText,
      });
    }
    return { rows, missingCount };
  }, [result, annotations, templateById, layerById, meterByPx, hasScale]);
}
