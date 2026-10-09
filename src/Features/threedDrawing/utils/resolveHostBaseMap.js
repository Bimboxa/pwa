import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";

import pickHostBaseMap from "./pickHostBaseMap";

// Host base map of a shape drawn in 3D, in order:
//   1. a base map carried unanimously by the drawn vertices (PLANE / scan
//      snaps stamp the plan the cursor was on);
//   2. the base map selected in 2D (`preferredBaseMapId`), when the shape
//      projects on it — the user draws relative to the plan they work on,
//      even from vertices / edges of existing annotations and axis locks,
//      which carry no base map;
//   3. the centroid heuristic (pickHostBaseMap): the base map whose footprint
//      contains the shape, then the closest plane. Without the preferred map
//      it re-hosted a face drawn 2 m above the selected plan on an upper
//      floor's plan, where nothing showed on the plan being edited.
//
// vertices: [{x, y, z, baseMapId?}] in world space. Returns a base map of
// `baseMaps` or null.
export default function resolveHostBaseMap({
  vertices,
  baseMaps,
  preferredBaseMapId = null,
}) {
  if (!vertices?.length || !baseMaps?.length) return null;

  const carriedIds = new Set(vertices.map((v) => v.baseMapId).filter(Boolean));
  if (carriedIds.size === 1) {
    const id = carriedIds.values().next().value;
    const carried = baseMaps.find((b) => b.id === id) ?? null;
    if (carried) return carried;
  }

  if (preferredBaseMapId) {
    const preferred = baseMaps.find((b) => b.id === preferredBaseMapId) ?? null;
    if (
      preferred &&
      vertices.every((v) => worldToBaseMapNormalized(v, preferred))
    ) {
      return preferred;
    }
  }

  return pickHostBaseMap(vertices, baseMaps);
}
