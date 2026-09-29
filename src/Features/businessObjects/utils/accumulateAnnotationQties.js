import {
  getAnnotationFormulaVariables,
  getQtyFormulaKey,
} from "./qtyFormula.js";

// Rollup rule of the linked annotations' quantities, shared by the business
// objects (useBusinessObjectQties) and the work packages (useWorkPackageHours):
// unit count = 1 per annotation unless it carries its own count
// (LINEAR_LAYOUT bars); length / surface only when the quantities are
// enabled, preferring the developed (sloped) values like the template
// rollups. Mesh cells must be skipped by the caller (their parent is
// already counted).
//
// formulasByTemplateId (business objects only — getQtyFormulasByTemplateId):
// an annotation whose template has a custom quantity formula also feeds
// stats.formula = {value, count, length, surface}: value = Σ of the formula
// evaluated per annotation, the rest = the raw share of those annotations
// (getBusinessObjectQtyValue swaps that share for the formula value). A
// constant formula (no variable) is a hand-entered value for the whole
// template: counted once per template (stats.formula.constantKeys).
export function createEmptyQties() {
  return { count: 0, length: 0, surface: 0 };
}

export default function accumulateAnnotationQties(
  stats,
  annotation,
  formulasByTemplateId
) {
  const { S, L, U } = getAnnotationFormulaVariables(annotation);
  stats.count += U;
  stats.length += L;
  stats.surface += S;

  const formula =
    formulasByTemplateId?.[getQtyFormulaKey(annotation?.annotationTemplateId)];
  if (formula) {
    if (!stats.formula) stats.formula = { value: 0, ...createEmptyQties() };
    if (!formula.isConstant) {
      stats.formula.value += formula.evaluate({ S, L, U });
    } else {
      const key = getQtyFormulaKey(annotation?.annotationTemplateId);
      if (!stats.formula.constantKeys) stats.formula.constantKeys = {};
      if (!stats.formula.constantKeys[key]) {
        stats.formula.constantKeys[key] = true;
        stats.formula.value += formula.evaluate({ S, L, U });
      }
    }
    stats.formula.count += U;
    stats.formula.length += L;
    stats.formula.surface += S;
  }
  return stats;
}
