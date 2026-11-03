// Altitudes are kept to 0.01 mm — NOT roundForDisplay (3 significant
// figures: centimetres off on an upper floor), which would lift the points
// off the faces they were snapped on (clipFaceByCutLines plane test).
const ALTITUDE_PRECISION = 1e5;
const roundAltitude = (v) =>
  Math.round(v * ALTITUDE_PRECISION) / ALTITUDE_PRECISION;

// Pure Z encoding of a cut line projected on its host base map (the ruler
// rule, always lifted): offsetZ = lowest offset, per-point
// offsetBottom = offset - offsetZ, so z_i = offsetZ + offsetBottom_i in
// base-map-local metres. The per-point flags (`derived`: added by the
// extension, `stop`: the line ends there) ride on the encoded points.
//
// `projected`: [{ x, y, offset, derived?, stop? }] from
// worldToBaseMapNormalized. Returns { offsetZ, points }.
export default function encodeCutLineRefs(projected) {
  const offsets = projected.map((p) => p.offset ?? 0);
  const min = offsets.length ? Math.min(...offsets) : 0;
  const points = projected.map((p, i) => ({
    x: p.x,
    y: p.y,
    offsetBottom: roundAltitude(offsets[i] - min),
    ...(p.derived ? { derived: true } : {}),
    ...(p.stop ? { stop: true } : {}),
  }));
  return { offsetZ: roundAltitude(min), points };
}
