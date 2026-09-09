// "12,5" — fr-FR, `decimals` is a precision cap (no forced trailing zeros:
// "4,9", not "4,90"), same rule as threedMesh/utils/formatSurfaceM2.
export default function formatBusinessObjectNumber(value, decimals = 1) {
  const v = Number.isFinite(value) ? value : 0;
  const factor = 10 ** decimals;
  return (Math.round(v * factor) / factor).toLocaleString("fr-FR", {
    maximumFractionDigits: decimals,
  });
}
