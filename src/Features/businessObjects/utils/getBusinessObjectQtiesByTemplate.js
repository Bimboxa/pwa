import accumulateAnnotationQties, {
  createEmptyQties,
} from "./accumulateAnnotationQties.js";
import { getQtyFormulaKey, getQtyFormulasByTemplateId } from "./qtyFormula.js";

// Breakdown of a business object's quantities per annotation template, from
// its linked annotations. Mesh cells are listed in their row but not counted
// (their parent is already counted).
// businessObject (optional): its custom quantity formulas are applied.
// => [{annotationTemplateId, annotationsCount, annotations, formula,
//      qties: {count, length, surface, formula?}}] in first-seen order;
// formula = the custom formula of the template, null when the default rule
// (the object's unit) applies.
export default function getBusinessObjectQtiesByTemplate(
  annotations,
  businessObject
) {
  const formulasByTemplateId = getQtyFormulasByTemplateId(businessObject);
  const rowByTemplateId = new Map();
  (annotations ?? []).forEach((annotation) => {
    const key = getQtyFormulaKey(annotation.annotationTemplateId);
    if (!rowByTemplateId.has(key))
      rowByTemplateId.set(key, {
        annotationTemplateId: annotation.annotationTemplateId ?? null,
        annotationsCount: 0,
        annotations: [],
        formula: formulasByTemplateId?.[key]?.formula ?? null,
        qties: createEmptyQties(),
      });
    const row = rowByTemplateId.get(key);
    row.annotations.push(annotation);
    if (annotation.isMeshCell) return;
    row.annotationsCount += 1;
    accumulateAnnotationQties(row.qties, annotation, formulasByTemplateId);
  });
  return [...rowByTemplateId.values()];
}
