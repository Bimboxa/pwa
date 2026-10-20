// Deviation of a manual legend qty vs the computed one, as "+12.3 %" /
// "-4.0 %". Empty when there is no manual value, "—" when the computed value
// is missing or zero (no ratio to show).
export default function getManualQtyDeviationLabel(manualQty, computedValue) {
  if (!Number.isFinite(manualQty)) return "";
  if (!Number.isFinite(computedValue) || computedValue === 0) return "—";
  const pct = ((manualQty - computedValue) / computedValue) * 100;
  return `${pct >= 0 ? "+" : "-"}${Math.abs(pct).toFixed(1)} %`;
}
