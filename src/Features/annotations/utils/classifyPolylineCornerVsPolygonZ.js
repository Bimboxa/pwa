// At a shared corner between a polygon (floor/ceiling slab) and a polyline
// (wall), classify the wall's vertical position relative to the polygon's
// top surface z and return which per-vertex offset field should be shifted
// when the polygon's top surface moves.
//
// Returns:
//   - "BOTTOM"  : wall is ABOVE the polygon (or touching it from above) →
//                 shift the wall's `offsetBottom` so it keeps resting on
//                 the floor as the floor moves.
//   - "TOP"     : wall is BELOW the polygon (or touching it from below) →
//                 shift the wall's `offsetTop` so it keeps reaching up to
//                 the ceiling as the ceiling moves.
//   - null      : wall straddles the polygon level (intermediate case) or
//                 degenerate; the move is not propagated.
//
// Inputs are all in meters. `polygonZ` is the polygon's top-surface altitude
// AT this corner (verticalLift + height + offsetBottom + offsetTop). The
// polyline's wall range at this corner is:
//   bottom = polylineOffsetZ + polylineOffsetBottom
//   top    = polylineOffsetZ + polylineHeight + polylineOffsetBottom + polylineOffsetTop
//
// `tol` (default 1e-4 m = 0.1 mm) absorbs floating-point noise when the wall
// is touching the polygon exactly.
export default function classifyPolylineCornerVsPolygonZ({
  polygonZ,
  polylineOffsetZ,
  polylineHeight,
  polylineOffsetBottom,
  polylineOffsetTop,
  tol = 1e-4,
}) {
  if (!Number.isFinite(polygonZ)) return null;
  const oz = polylineOffsetZ ?? 0;
  const h = polylineHeight ?? 0;
  const ob = polylineOffsetBottom ?? 0;
  const ot = polylineOffsetTop ?? 0;
  const wallBottom = oz + ob;
  const wallTop = oz + h + ob + ot;
  const isAbove = wallBottom >= polygonZ - tol;
  const isBelow = wallTop <= polygonZ + tol;
  // Both true only for a zero-height wall sitting exactly at polygonZ —
  // degenerate, no propagation.
  if (isAbove && isBelow) return null;
  if (isAbove) return "BOTTOM";
  if (isBelow) return "TOP";
  return null;
}
