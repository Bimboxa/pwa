/**
 * Procedure label suffixed with the configured water level, e.g.
 * "Cuvelage auto [Ht. eau: 12.50 m]". Falls back to the plain label when the
 * procedure has no water option or no value is set (0 is a valid level).
 */
export default function getProcedureLabelWithWater(procedure, waterHeight) {
  const parsed =
    waterHeight != null && waterHeight !== "" ? parseFloat(waterHeight) : null;
  if (procedure?.showWaterHeight && parsed != null && Number.isFinite(parsed)) {
    return `${procedure.label} [Ht. eau: ${parsed.toFixed(2)} m]`;
  }
  return procedure?.label;
}
