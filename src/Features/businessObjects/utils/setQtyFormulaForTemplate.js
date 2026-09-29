import { normalizeQtyFormula } from "./qtyFormula.js";

// Next businessObject.qtyFormulas after editing the formula of one annotation
// template (annotationTemplateId null = annotations without template). Only
// the custom formulas are stored: an empty formula, or one equal to the
// default formula of the object's unit, drops the entry.
export default function setQtyFormulaForTemplate(
  qtyFormulas,
  annotationTemplateId,
  formula,
  defaultFormula
) {
  const templateId = annotationTemplateId ?? null;
  const others = (Array.isArray(qtyFormulas) ? qtyFormulas : []).filter(
    (item) => (item?.annotationTemplateId ?? null) !== templateId
  );
  const text = typeof formula === "string" ? formula.trim() : "";
  const isDefault =
    !text || normalizeQtyFormula(text) === normalizeQtyFormula(defaultFormula);
  if (isDefault) return others;
  return [...others, { annotationTemplateId: templateId, formula: text }];
}
