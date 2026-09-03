import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";

// Max distance (m) from a base map plane for a point to count as "on" it.
const OFFSET_EPS_M = 5e-3;

// Find the base map whose plane a world point sits on: the first candidate
// where the projection lands inside the image bounds with a near-zero
// off-plane offset. Used to resolve the host of a vertex-snapped point that
// carries no baseMapId of its own (e.g. the rectangle anchor snapped to an
// existing annotation vertex).
//
// Returns { baseMap, rel } (rel = { x, y, offset } normalized) or null.
export default function resolveBaseMapForPoint(
  worldPoint,
  baseMaps,
  { offsetEps = OFFSET_EPS_M } = {}
) {
  if (!worldPoint || !baseMaps?.length) return null;
  for (const baseMap of baseMaps) {
    const rel = worldToBaseMapNormalized(worldPoint, baseMap);
    if (!rel) continue;
    if (Math.abs(rel.offset) > offsetEps) continue;
    if (rel.x < 0 || rel.x > 1 || rel.y < 0 || rel.y > 1) continue;
    return { baseMap, rel };
  }
  return null;
}
