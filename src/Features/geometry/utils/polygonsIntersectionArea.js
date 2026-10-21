import polygonClipping from "polygon-clipping";

// Area of the intersection of two polygon-clipping multipolygons
// ([ [outerRing, ...holeRings], ... ], rings as [x, y] pairs), plus each
// input's own area. Same ring conventions as polygonsIoU.

export function ringArea(ring) {
  let sum = 0;
  const n = ring.length;
  for (let i = 0; i < n; i += 1) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % n];
    sum += ax * by - bx * ay;
  }
  return Math.abs(sum / 2);
}

export function multiPolygonArea(multiPolygon) {
  let area = 0;
  for (const poly of multiPolygon ?? []) {
    poly.forEach((ring, r) => {
      const a = ringArea(ring);
      area += r === 0 ? a : -a;
    });
  }
  return Math.max(0, area);
}

// → { interArea, areaA, areaB } (all 0 when a polygon is degenerate or the
// clipping fails).
export default function polygonsIntersectionArea(multiPolygonA, multiPolygonB) {
  const areaA = multiPolygonArea(multiPolygonA);
  const areaB = multiPolygonArea(multiPolygonB);
  if (areaA <= 0 || areaB <= 0) return { interArea: 0, areaA, areaB };
  let inter;
  try {
    inter = polygonClipping.intersection(multiPolygonA, multiPolygonB);
  } catch {
    return { interArea: 0, areaA, areaB };
  }
  return { interArea: multiPolygonArea(inter), areaA, areaB };
}
