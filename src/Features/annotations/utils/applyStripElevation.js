// When duplicating a POLYLINE (wall) into a STRIP (band), place the band's 3D
// surface at the TOP or the BOTTOM of the source wall.
//
// A wall POLYLINE spans, at point i, from `offsetZ + offsetBottom_i` (bottom)
// to `offsetZ + height + offsetBottom_i + offsetTop_i` (top). We want the band
// surface to sit on one of those edges. The band's surface Z at point i is
// `offsetZ + offsetTop_i` for the sloped (open) 3D path, but the flat (closed /
// annular) 3D path ignores per-point `offsetTop` and uses `offsetZ` only. So we
// split the lift: the bulk goes into the band's `offsetZ` (see
// getStripElevationOffsetZ) — honored by BOTH paths — and only the per-point
// residual stays in `offsetTop` (honored by the sloped path), keeping closed
// bands at the right level while sloped open bands still follow the wall.
//
//   band offsetZ + offsetTop_i  ==  wall top / bottom  (sloped path, exact)
//   band offsetZ                ==  nominal top / bottom (flat path, per-point
//                                   residual flattened)

// Bulk vertical lift to apply to the band's `offsetZ`.
// TOP: source.offsetZ + source.height ; BOTTOM: source.offsetZ.
export function getStripElevationOffsetZ(source, stripElevation) {
  const oz = Number(source?.offsetZ) || 0;
  const h = Number(source?.height) || 0;
  return stripElevation === "TOP" ? oz + h : oz;
}

// Returns a NEW points array (never mutates the source points), carrying the
// per-point residual elevation relative to the bulk offsetZ lift above.
// TOP: offsetTop_i = offsetBottom_i + offsetTop_i ; BOTTOM: offsetTop_i = offsetBottom_i.
export default function applyStripElevation(points, stripElevation) {
  if (!Array.isArray(points)) return points;
  return points.map((p) => {
    const ob = Number(p?.offsetBottom) || 0;
    const ot = Number(p?.offsetTop) || 0;
    const offsetTop = stripElevation === "TOP" ? ob + ot : ob;
    return { ...p, offsetTop, offsetBottom: 0 };
  });
}
