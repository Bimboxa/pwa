import polygonClipping from "polygon-clipping";

// Intersection-over-union of two polygons (each: an outer ring + optional
// holes, points in the same coordinate space). Returns a ratio in [0, 1];
// ~1 means the two shapes are essentially identical. IoU (not one-sided
// coverage) is deliberate: a small polygon nested inside a big one has a low
// IoU, so it is NOT treated as a duplicate — only near-equal shapes score high.

function ringArea(ring) {
  let sum = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % n];
    sum += ax * by - bx * ay;
  }
  return Math.abs(sum / 2);
}

// polygon-clipping multipolygon: [ [outerRing, ...holeRings], ... ]
function multiPolygonArea(mp) {
  let area = 0;
  for (const poly of mp ?? []) {
    poly.forEach((ring, r) => {
      const a = ringArea(ring);
      area += r === 0 ? a : -a;
    });
  }
  return area;
}

function toMultiPolygon(poly) {
  const outer = (poly?.outer ?? []).map((p) => [p.x, p.y]);
  const holes = (poly?.holes ?? [])
    .filter((h) => h && h.length >= 3)
    .map((h) => h.map((p) => [p.x, p.y]));
  return [[outer, ...holes]];
}

/**
 * @param {{outer: Array<{x,y}>, holes?: Array<Array<{x,y}>>}} a
 * @param {{outer: Array<{x,y}>, holes?: Array<Array<{x,y}>>}} b
 * @returns {number} intersection area / union area, in [0, 1]
 */
export default function polygonsIoU(a, b) {
  if (!(a?.outer?.length >= 3) || !(b?.outer?.length >= 3)) return 0;
  const A = toMultiPolygon(a);
  const B = toMultiPolygon(b);

  let inter;
  try {
    inter = polygonClipping.intersection(A, B);
  } catch {
    return 0;
  }
  const interArea = multiPolygonArea(inter);
  if (interArea <= 0) return 0;

  const areaA = multiPolygonArea(A);
  const areaB = multiPolygonArea(B);
  const union = areaA + areaB - interArea;
  return union > 0 ? interArea / union : 0;
}
