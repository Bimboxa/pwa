// When duplicating a POLYLINE (wall) into a STRIP (band), place the band's 3D
// surface at the TOP or the BOTTOM of the source wall.
//
// The wall's edges depend on how the source POLYLINE extrudes (per point i):
//   - thin (PX) wall (extrudePolylineWall): the top stays fixed at
//       `offsetZ + height + offsetTop_i`  — offsetBottom only lowers the BASE,
//     and the bottom is `offsetZ + offsetBottom_i`.
//   - CM-width wall (extrudeWallPolygon → triangulate, a slab): the whole slab
//     is shifted by offsetBottom, so top = `offsetZ + height + offsetBottom_i +
//     offsetTop_i` and bottom = `offsetZ + offsetBottom_i`.
//
// The band's surface Z at point i is `offsetZ + offsetTop_i` (the sloped strip
// path uses offsetTop only). We split the lift: the bulk goes into the band's
// `offsetZ` (see getStripElevationOffsetZ) and the per-point residual stays in
// `offsetTop`, so the band lands exactly on the wall's real top/bottom edge.
//
//   band offsetZ + offsetTop_i  ==  wall top / bottom edge (exact)

// Bulk vertical lift to apply to the band's `offsetZ`.
// TOP: source.offsetZ + source.height ; BOTTOM: source.offsetZ.
export function getStripElevationOffsetZ(source, stripElevation) {
  const oz = Number(source?.offsetZ) || 0;
  const h = Number(source?.height) || 0;
  return stripElevation === "TOP" ? oz + h : oz;
}

// Returns a NEW points array (never mutates the source points), carrying the
// per-point residual elevation relative to the bulk offsetZ lift above.
//
// BOTTOM (both conventions): offsetTop_i = offsetBottom_i.
// TOP, thin (PX) wall:        offsetTop_i = offsetTop_i (top ignores offsetBottom).
// TOP, CM slab wall:          offsetTop_i = offsetBottom_i + offsetTop_i.
//
// `source` is the source POLYLINE — its strokeWidthUnit selects the top
// convention. Defaults to the thin-wall convention when source is absent.
export default function applyStripElevation(points, stripElevation, source) {
  if (!Array.isArray(points)) return points;
  const topIncludesOffsetBottom = source?.strokeWidthUnit === "CM";
  return points.map((p) => {
    const ob = Number(p?.offsetBottom) || 0;
    const ot = Number(p?.offsetTop) || 0;
    let offsetTop;
    if (stripElevation === "TOP") {
      offsetTop = topIncludesOffsetBottom ? ob + ot : ot;
    } else {
      offsetTop = ob;
    }
    return { ...p, offsetTop, offsetBottom: 0 };
  });
}
