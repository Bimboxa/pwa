import getAnnotationQties from "./getAnnotationQties";
import getAnnotationTemplateMainQtyLabel from "./getAnnotationTemplateMainQtyLabel";

/**
 * Pure function that aggregates annotation quantities by template ID.
 *
 * @param {Array} annotations - Annotations array (with resolved points).
 *   If each annotation already has a `.qties` property it is reused;
 *   otherwise `getAnnotationQties` is called (needs `meterByPx`).
 * @param {Object} annotationTemplateById - Map of template id → template.
 * @param {Object} [baseMapById] - Map of baseMap id → baseMap (needed only
 *   when annotations don't carry pre-computed `.qties`).
 * @returns {{ [templateId]: { count, length, surface, unit, mainQtyLabel } }}
 */
export default function computeAnnotationTemplateQties(
  annotations,
  annotationTemplateById,
  baseMapById
) {
  if (!annotations) return {};

  const qtiesById = annotations.reduce((acc, annotation) => {
    const templateId = annotation?.annotationTemplateId;
    if (!templateId) return acc;
    // Mesh cells are children of a parent annotation that is already counted;
    // skip them so the parent + its cells don't double-count quantities.
    if (annotation?.isMeshCell) return acc;

    if (!acc[templateId]) {
      acc[templateId] = { count: 0, length: 0, surface: 0, unit: 0, mainQtyLabel: "-" };
    }

    const stats = acc[templateId];
    stats.count += 1;
    stats.unit = stats.count;

    // Use pre-computed qties when available (withQties was used),
    // otherwise compute on the fly.
    let qty = annotation.qties;
    if (!qty && baseMapById) {
      const baseMap = annotation.baseMapId ? baseMapById[annotation.baseMapId] : null;
      const meterByPx = baseMap?.getMeterByPx();
      qty = getAnnotationQties({ annotation, meterByPx });
    }

    if (qty && qty.enabled) {
      // Prefer the developed (sloped) values when a guideLine ramp is present,
      // so per-template totals reflect the real material quantity.
      const length = qty.lengthDeveloped != null ? qty.lengthDeveloped : qty.length;
      const surface = qty.surfaceDeveloped != null ? qty.surfaceDeveloped : qty.surface;
      if (Number.isFinite(length)) stats.length += length;
      if (Number.isFinite(surface)) stats.surface += surface;
    }

    return acc;
  }, {});

  // Format labels
  Object.entries(qtiesById).forEach(([templateId, stats]) => {
    const template = annotationTemplateById?.[templateId];
    if (!template) {
      stats.mainQtyLabel = `${stats.unit ?? "-"} u`;
      return;
    }
    stats.mainQtyLabel = getAnnotationTemplateMainQtyLabel(template, stats);
  });

  return qtiesById;
}
