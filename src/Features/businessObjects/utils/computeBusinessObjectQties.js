import accumulateAnnotationQties, {
  createEmptyQties,
} from "./accumulateAnnotationQties.js";
import resolveBusinessObjectAnnotationLinks from "./resolveBusinessObjectAnnotationLinks.js";
import { getQtyFormulasByTemplateId } from "./qtyFormula.js";

// Rolls up the quantities of every business object from the annotations
// feeding it: the rel-linked ones and, for the objects linked to whole
// annotation templates (businessObject.linkedTemplateIds), every annotation
// of those templates — one count per annotation whatever the number of links
// (resolveBusinessObjectAnnotationLinks). No hierarchical aggregation (v1):
// an object only counts its own annotations. Mesh cells are skipped — their
// parent is already counted.
//
// Pure: the caller decides which annotations are in play, so the same rule
// serves the whole scope (useBusinessObjectQties) and a single base map (the
// SCOPE module recap).
//
// rels: [relBusinessObjectAnnotation], annotations: [annotation with .qties],
// businessObjects (optional): the objects, for their custom quantity formulas
// per annotation template (businessObject.qtyFormulas) AND their template
// links — a caller omitting them falls back to the rels and the unit rule.
// => {qtiesByObjectId, annotationsByObjectId, mainRelsByObjectId,
//     mainAnnotationsByObjectId} — the last two hold the objects' MAIN
// annotations (rels flagged isMain; one per base map, or several when the
// listing allows it — allowsMultipleLocationAnnotations).
export default function computeBusinessObjectQties({
  rels,
  annotations,
  businessObjects,
} = {}) {
  const formulasByObjectId = {};
  (businessObjects ?? []).forEach((businessObject) => {
    const formulas = getQtyFormulasByTemplateId(businessObject);
    if (formulas) formulasByObjectId[businessObject.id] = formulas;
  });
  const { rowsByObjectId } = resolveBusinessObjectAnnotationLinks({
    rels,
    annotations,
    businessObjects,
  });

  const qtiesByObjectId = {};
  const annotationsByObjectId = {};
  const mainRelsByObjectId = {};
  const mainAnnotationsByObjectId = {};

  Object.entries(rowsByObjectId).forEach(([objectId, rows]) => {
    rows.forEach(({ annotation, rel }) => {
      if (rel?.isMain) {
        if (!mainRelsByObjectId[objectId]) {
          mainRelsByObjectId[objectId] = [];
          mainAnnotationsByObjectId[objectId] = [];
        }
        mainRelsByObjectId[objectId].push(rel);
        mainAnnotationsByObjectId[objectId].push(annotation);
      }
      // Mesh cells are children of a parent annotation that is already
      // counted; skip them so quantities are not double-counted.
      if (annotation.isMeshCell) return;

      if (!qtiesByObjectId[objectId]) {
        qtiesByObjectId[objectId] = createEmptyQties();
        annotationsByObjectId[objectId] = [];
      }
      annotationsByObjectId[objectId].push(annotation);

      accumulateAnnotationQties(
        qtiesByObjectId[objectId],
        annotation,
        formulasByObjectId[objectId]
      );
    });
  });

  return {
    qtiesByObjectId,
    annotationsByObjectId,
    mainRelsByObjectId,
    mainAnnotationsByObjectId,
  };
}
