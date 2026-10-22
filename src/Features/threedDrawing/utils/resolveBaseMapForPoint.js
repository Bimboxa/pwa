import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";

// Max distance (m) from a base map plane for a point to count as "on" it.
const OFFSET_EPS_M = 5e-3;

// Find the base map whose plane a world point sits on: a candidate where the
// projection lands inside the image bounds with a near-zero off-plane
// offset. Used to resolve the host of a vertex-snapped point that carries no
// baseMapId of its own (e.g. the rectangle anchor or the revolution axis
// centre snapped to an existing annotation vertex).
//
// Several base maps may contain the point (stacked unplaced plans at the
// origin): `preferredBaseMapId` (the base map selected in 3D, else the main
// one — useDrawingPreferredBaseMapId) wins when it is one of them, else the
// first candidate in `baseMaps` order.
//
// Returns { baseMap, rel } (rel = { x, y, offset } normalized) or null.
export default function resolveBaseMapForPoint(
  worldPoint,
  baseMaps,
  { offsetEps = OFFSET_EPS_M, preferredBaseMapId = null } = {}
) {
  if (!worldPoint || !baseMaps?.length) return null;
  let first = null;
  for (const baseMap of baseMaps) {
    const rel = worldToBaseMapNormalized(worldPoint, baseMap);
    if (!rel) continue;
    if (Math.abs(rel.offset) > offsetEps) continue;
    if (rel.x < 0 || rel.x > 1 || rel.y < 0 || rel.y > 1) continue;
    if (baseMap.id === preferredBaseMapId) return { baseMap, rel };
    if (!first) {
      first = { baseMap, rel };
      if (!preferredBaseMapId) break;
    }
  }
  return first;
}
