import formatBusinessObjectNumber from "./formatBusinessObjectNumber.js";
import getBusinessObjectQtyGap from "./getBusinessObjectQtyGap.js";
import { getBusinessObjectUnitLabel } from "./getBusinessObjectQtyLabel.js";
import getBusinessObjectQtyValue from "./getBusinessObjectQtyValue.js";

/**
 * Issues ("points d'attention") to raise on the business objects whose
 * quantity computed from the linked annotations is too far from the
 * reference quantity of the source document (refQty) — same rule as the
 * warning of the tree rows (getBusinessObjectQtyGap, > 5 %).
 *
 * An object without linked annotation is not compared: nothing was measured.
 *
 * @param {Object} params
 * @param {Array<Object>} params.businessObjects - rows (unit, refQty, code…)
 * @param {Object} params.qtiesByObjectId - computeBusinessObjectQties output
 * @param {Object} params.annotationsByObjectId - idem
 * @returns {Array<{businessObject: Object, label: string,
 *   description: string, annotationIds: string[], gap: Object}>}
 */
export default function buildQtyGapIssues({
  businessObjects,
  qtiesByObjectId,
  annotationsByObjectId,
}) {
  const issues = [];
  for (const businessObject of businessObjects ?? []) {
    if (businessObject.isTitle) continue;
    const annotations = annotationsByObjectId?.[businessObject.id] ?? [];
    if (!annotations.length) continue;
    const computedQty = getBusinessObjectQtyValue(
      businessObject.unit,
      qtiesByObjectId?.[businessObject.id]
    );
    const gap = getBusinessObjectQtyGap(computedQty, businessObject.refQty);
    if (!gap?.isOver) continue;

    const unitLabel = getBusinessObjectUnitLabel(businessObject.unit);
    const format = (value) =>
      `${formatBusinessObjectNumber(value, 1)} ${unitLabel}`;
    const sign = gap.delta > 0 ? "+" : "";
    const ratioS = Number.isFinite(gap.ratio)
      ? ` (${sign}${formatBusinessObjectNumber(
          Math.sign(gap.delta) * gap.ratio * 100,
          1
        )} %)`
      : "";
    const name = [businessObject.code, businessObject.label]
      .filter(Boolean)
      .join(" ");

    issues.push({
      businessObject,
      label: `Écart de quantité — ${name}`,
      description: [
        `Quantité de référence : ${format(businessObject.refQty)}`,
        `Quantité calculée : ${format(computedQty)} (${annotations.length} annotation(s))`,
        `Écart : ${sign}${format(gap.delta)}${ratioS}`,
      ].join("\n"),
      annotationIds: annotations.map((a) => a.id),
      gap,
    });
  }
  return issues;
}
