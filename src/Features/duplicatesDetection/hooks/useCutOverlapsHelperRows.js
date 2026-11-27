import { useMemo } from "react";

import createAnnotationLabeler from "../utils/createAnnotationLabeler";

const EMPTY = { rows: [] };

// Joins the polygons whose own cuts (openings) overlap — `cutOverlaps` of the
// last run — with the helper's live annotations / templates into display
// rows, shaped for RowDuplicateAnnotation (`detailText` replaces its overlap
// line): the surface subtracted in excess, in m² (calibrated run) or px², and
// the number of openings involved. Annotations deleted since the run are
// skipped.
export default function useCutOverlapsHelperRows({
  result,
  annotations,
  templateById,
  meterByPx,
  hasScale,
}) {
  return useMemo(() => {
    const cutOverlaps = result?.cutOverlaps ?? [];
    if (!cutOverlaps.length) return EMPTY;

    const { byId, getLabel } = createAnnotationLabeler(
      annotations,
      templateById
    );
    const formatArea = (areaPx) =>
      hasScale && meterByPx
        ? `${(areaPx * meterByPx * meterByPx).toFixed(2)} m²`
        : `${Math.round(areaPx)} px²`;

    const rows = [];
    for (const overlap of cutOverlaps) {
      const annotation = byId.get(overlap.annotationId);
      if (!annotation) continue;
      rows.push({
        ...overlap,
        annotation,
        template: templateById?.[annotation.annotationTemplateId],
        label: getLabel(annotation),
        detailText: `${formatArea(overlap.overCountedPx)} en trop · ${overlap.cutsCount} ouvertures`,
        warning: true,
      });
    }
    return { rows };
  }, [result, annotations, templateById, meterByPx, hasScale]);
}
