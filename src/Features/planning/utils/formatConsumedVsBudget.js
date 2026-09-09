import { formatHours } from "Features/businessObjects/utils/hoursRatioConversions";

// "12 h / 37 h" — consumed vs budget; budget null => "12 h". Compact form
// (no man-days: the pair would be unreadable in a row caption). Also returns
// the signed difference (consumed − budget) for the colour of the caption.
export default function formatConsumedVsBudget(consumed, budget) {
  const c = consumed ?? 0;
  const compact = { withDays: false };
  if (budget == null)
    return { text: formatHours(c, compact), diff: null };
  return {
    text: `${formatHours(c, compact)} / ${formatHours(budget, compact)}`,
    diff: c - budget,
  };
}
