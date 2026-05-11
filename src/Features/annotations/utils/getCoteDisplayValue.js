const UNIT_FACTORS_FROM_METERS = {
  MM: 1000,
  CM: 100,
  M: 1,
};

const UNIT_SUFFIXES = {
  MM: "mm",
  CM: "cm",
  M: "m",
};

export default function getCoteDisplayValue({
  p1,
  p2,
  meterByPx,
  unit = "CM",
  decimals = 0,
  showUnitLabel = false,
}) {
  if (!p1 || !p2) return "";

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const pixelDistance = Math.hypot(dx, dy);

  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  if (!hasScale) return "—";

  const meters = pixelDistance * meterByPx;
  const factor = UNIT_FACTORS_FROM_METERS[unit] ?? UNIT_FACTORS_FROM_METERS.CM;
  const value = meters * factor;

  const safeDecimals = Math.max(0, Math.min(6, Number(decimals) || 0));
  const formatted = value.toFixed(safeDecimals);

  if (!showUnitLabel) return formatted;
  const suffix = UNIT_SUFFIXES[unit] ?? "";
  return suffix ? `${formatted} ${suffix}` : formatted;
}
