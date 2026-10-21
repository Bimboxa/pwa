import { useMemo } from "react";

import { getAnnotationOwnLabel } from "Features/annotations/utils/getAnnotationLabelDisplay";
import getZeroPaddingNumber from "Features/misc/utils/getZeroPaddingNumber";

const EMPTY = { rows: [], missingCount: 0 };

// Joins the duplicates of the last run with the helper's live annotations /
// templates into display rows: label (own label, else « Modèle 03 » numbered
// in the template's draw order like the Dessin panel), swatch color, overlap
// text in m (calibrated run) or px. Annotations deleted since the run are
// counted in `missingCount` instead of rendered.
export default function useDuplicatesHelperRows({
  result,
  annotations,
  templateById,
  meterByPx,
  hasScale,
}) {
  return useMemo(() => {
    const duplicates = result?.duplicates ?? [];
    if (!duplicates.length) return EMPTY;

    const byId = new Map();
    const byTemplateId = new Map();
    for (const a of annotations ?? []) {
      byId.set(a.id, a);
      if (!a.annotationTemplateId) continue;
      const list = byTemplateId.get(a.annotationTemplateId);
      if (list) list.push(a);
      else byTemplateId.set(a.annotationTemplateId, [a]);
    }
    const rankById = new Map();
    for (const list of byTemplateId.values()) {
      list
        .slice()
        .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
        .forEach((a, idx) => rankById.set(a.id, idx + 1));
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
      const label =
        getAnnotationOwnLabel(annotation) ||
        `${template?.label ?? annotation.type} ${getZeroPaddingNumber(
          rankById.get(annotation.id) ?? 0,
          2
        )}`;
      const color =
        template?.fillColor ??
        template?.strokeColor ??
        annotation.fillColor ??
        annotation.strokeColor ??
        "#999999";
      const overlapText =
        hasScale && meterByPx
          ? `${(dup.overlapPx * meterByPx).toFixed(2)} m`
          : `${Math.round(dup.overlapPx)} px`;
      rows.push({ ...dup, annotation, template, label, color, overlapText });
    }
    return { rows, missingCount };
  }, [result, annotations, templateById, meterByPx, hasScale]);
}
