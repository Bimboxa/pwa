import {
  DEFAULT_COTE_DECIMALS,
  DEFAULT_COTE_UNIT,
  UNIT_FACTORS_FROM_METERS,
  UNIT_SUFFIXES,
} from "./coteConstants";

// Format a world-space length (in meters — the 3D scene works in meters via
// pixelToWorld's meterByPx) into a cote label using the cote's unit and
// decimals settings (e.g. "245 cm", "2.45 m"). The unit suffix is always
// appended.
export default function formatCoteLength({
  meters,
  unit = DEFAULT_COTE_UNIT,
  decimals = DEFAULT_COTE_DECIMALS,
}) {
  const factor = UNIT_FACTORS_FROM_METERS[unit] ?? UNIT_FACTORS_FROM_METERS.M;
  const value = (Number(meters) || 0) * factor;
  const safeDecimals = Math.max(0, Math.min(6, Number(decimals) || 0));
  const suffix = UNIT_SUFFIXES[unit] ?? "";
  return `${value.toFixed(safeDecimals)} ${suffix}`.trim();
}
