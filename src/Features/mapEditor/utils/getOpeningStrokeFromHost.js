// Thickness an opening inherits from the wall it is dropped on: the host's
// band width, expressed in CM (the OPENING template unit) so the white gap of
// NodeOpeningStatic exactly covers the wall. POLYGON hosts have no thickness
// (the carve makes the gap) → null, the template value stays.
//
// @param {Object} host - host annotation (POLYLINE / STRIP / POLYGON)
// @param {number} meterByPx - base map scale (needed for PX band widths)
// @returns {null | { strokeWidth: number, strokeWidthUnit: "CM" }}
export default function getOpeningStrokeFromHost(host, meterByPx) {
  if (!host || !["POLYLINE", "STRIP"].includes(host.type)) return null;
  const w = Number(host.strokeWidth);
  if (!(w > 0)) return null;
  if (host.strokeWidthUnit === "CM") {
    return { strokeWidth: w, strokeWidthUnit: "CM" };
  }
  // Raw pixels: only convertible with a scale.
  if (!(meterByPx > 0)) return null;
  const cm = Math.round(w * meterByPx * 100 * 100) / 100;
  return cm > 0 ? { strokeWidth: cm, strokeWidthUnit: "CM" } : null;
}
