// Relative gap above which the computed quantity (linked annotations) is
// flagged against the reference quantity (refQty, from the source document).
export const BUSINESS_OBJECT_QTY_GAP_THRESHOLD = 0.05;

// Gap between the computed quantity and the reference one.
// => {delta, ratio, isOver} | null when one of the two is missing.
// delta = computed - reference; ratio = |delta| / |reference| (Infinity for a
// null reference with a computed quantity).
export default function getBusinessObjectQtyGap(computedQty, refQty) {
  if (!Number.isFinite(computedQty) || !Number.isFinite(refQty)) return null;
  const delta = computedQty - refQty;
  const ratio =
    refQty === 0 ? (delta === 0 ? 0 : Infinity) : Math.abs(delta / refQty);
  return { delta, ratio, isOver: ratio > BUSINESS_OBJECT_QTY_GAP_THRESHOLD };
}
