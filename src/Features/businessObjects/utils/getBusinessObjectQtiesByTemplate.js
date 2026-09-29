import accumulateAnnotationQties, {
  createEmptyQties,
} from "./accumulateAnnotationQties.js";

// Breakdown of a business object's quantities per annotation template, from
// its linked annotations (mesh cells already skipped by
// computeBusinessObjectQties).
// => [{annotationTemplateId, annotationsCount, qties: {count, length, surface}}]
// in first-seen order.
export default function getBusinessObjectQtiesByTemplate(annotations) {
  const rowByTemplateId = new Map();
  (annotations ?? []).forEach((annotation) => {
    if (annotation.isMeshCell) return;
    const key = annotation.annotationTemplateId ?? "";
    if (!rowByTemplateId.has(key))
      rowByTemplateId.set(key, {
        annotationTemplateId: annotation.annotationTemplateId ?? null,
        annotationsCount: 0,
        qties: createEmptyQties(),
      });
    const row = rowByTemplateId.get(key);
    row.annotationsCount += 1;
    accumulateAnnotationQties(row.qties, annotation);
  });
  return [...rowByTemplateId.values()];
}
