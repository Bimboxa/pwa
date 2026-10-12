import accumulateAnnotationQties, {
  createEmptyQties,
} from "./accumulateAnnotationQties.js";
import { getLinkedTemplateIds } from "./linkedTemplateIds.js";
import { getQtyFormulaKey, getQtyFormulasByTemplateId } from "./qtyFormula.js";

// Breakdown of a business object's quantities per annotation template, from
// the annotations feeding it (rel-linked and template-linked, see
// resolveBusinessObjectAnnotationLinks). Mesh cells are listed in their row
// but not counted (their parent is already counted).
// businessObject (optional): its custom quantity formulas are applied and
// its template links ("Lien par modèle") flag the rows; a linked template
// without annotation gets an EMPTY row so the link stays visible.
// options.relAnnotationIds (optional Set): ids of the annotations linked by
// annotation (rels) — counted per row in relLinkedCount (null when the set
// is not given).
// => [{annotationTemplateId, annotationsCount, annotations, formula,
//      isLinkedByTemplate, relLinkedCount,
//      qties: {count, length, surface, formula?}}] in first-seen order;
// formula = the custom formula of the template, null when the default rule
// (the object's unit) applies.
export default function getBusinessObjectQtiesByTemplate(
  annotations,
  businessObject,
  { relAnnotationIds } = {}
) {
  const formulasByTemplateId = getQtyFormulasByTemplateId(businessObject);
  const linkedTemplateIds = getLinkedTemplateIds(businessObject);
  const linkedSet = new Set(linkedTemplateIds);
  const rowByTemplateId = new Map();

  function getRow(annotationTemplateId) {
    const key = getQtyFormulaKey(annotationTemplateId);
    if (!rowByTemplateId.has(key))
      rowByTemplateId.set(key, {
        annotationTemplateId: annotationTemplateId ?? null,
        annotationsCount: 0,
        annotations: [],
        formula: formulasByTemplateId?.[key]?.formula ?? null,
        isLinkedByTemplate: Boolean(
          annotationTemplateId && linkedSet.has(annotationTemplateId)
        ),
        relLinkedCount: relAnnotationIds ? 0 : null,
        qties: createEmptyQties(),
      });
    return rowByTemplateId.get(key);
  }

  (annotations ?? []).forEach((annotation) => {
    const row = getRow(annotation.annotationTemplateId);
    row.annotations.push(annotation);
    if (annotation.isMeshCell) return;
    row.annotationsCount += 1;
    if (relAnnotationIds?.has(annotation.id)) row.relLinkedCount += 1;
    accumulateAnnotationQties(row.qties, annotation, formulasByTemplateId);
  });

  // linked templates without annotation in play: empty row
  linkedTemplateIds.forEach((templateId) => getRow(templateId));

  return [...rowByTemplateId.values()];
}
