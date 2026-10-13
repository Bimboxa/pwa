import polygonClipping from "polygon-clipping";
import { ShapeUtils, Vector2 } from "three";

// Pierces a triangle soup with vertical holes: every triangle whose plan
// projection (local x / y) overlaps a hole polygon is replaced by the
// triangulation of (triangle − holes), the new vertices taking their z on
// the triangle's own plane. Triangles entirely inside a hole are dropped,
// the others are kept as they are. Used to open a DISC « Coupole » (a lathe
// cannot carry holes) with the annotation's 2D cuts.
//
// Near-vertical triangles (no plan area — the dome rim, the walls of a solid)
// cannot be clipped in plan: they are kept or dropped as a whole from the
// position of their centroid.
//
// @param {ArrayLike<number>} positions  non-indexed xyz soup (local metres)
// @param {Array<Array<{x:number,y:number}>>} holes  plan rings (local metres,
//   arcs already expanded)
// @returns {number[]} the clipped soup
const AREA_EPS = 1e-9;

const ringBbox = (ring) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of ring) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
};

const bboxesOverlap = (a, b) =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

const toClosedRing = (ring) => {
  const out = ring.map((p) => [p.x, p.y]);
  const [fx, fy] = out[0];
  const [lx, ly] = out[out.length - 1];
  if (fx !== lx || fy !== ly) out.push([fx, fy]);
  return out;
};

const pointInRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const crosses =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
};

const ringArea = (ring) => {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    s += ax * by - bx * ay;
  }
  return s / 2;
};

export default function clipSoupByPlanHoles(positions, holes) {
  const rings = (holes ?? []).filter((h) => (h?.length ?? 0) >= 3);
  if (!rings.length || !positions?.length) return Array.from(positions ?? []);
  const holeBboxes = rings.map(ringBbox);
  const holeMultis = rings.map((r) => [[toClosedRing(r)]]);
  const out = [];

  for (let i = 0; i + 8 < positions.length; i += 9) {
    const ax = positions[i];
    const ay = positions[i + 1];
    const az = positions[i + 2];
    const bx = positions[i + 3];
    const by = positions[i + 4];
    const bz = positions[i + 5];
    const cx = positions[i + 6];
    const cy = positions[i + 7];
    const cz = positions[i + 8];
    const tri = [
      { x: ax, y: ay },
      { x: bx, y: by },
      { x: cx, y: cy },
    ];
    const tb = ringBbox(tri);
    const touched = holeBboxes
      .map((hb, k) => (bboxesOverlap(tb, hb) ? k : -1))
      .filter((k) => k >= 0);
    if (!touched.length) {
      out.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      continue;
    }

    // Plane z = p·x + q·y + r of the triangle (plan-degenerate ⇒ vertical).
    const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(det) < AREA_EPS) {
      const mx = (ax + bx + cx) / 3;
      const my = (ay + by + cy) / 3;
      const inHole = touched.some((k) => pointInRing(mx, my, rings[k]));
      if (!inHole) out.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      continue;
    }
    const p = ((bz - az) * (cy - ay) - (cz - az) * (by - ay)) / det;
    const q = ((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / det;
    const r = az - p * ax - q * ay;
    const zAt = (x, y) => p * x + q * y + r;

    let result;
    try {
      result = polygonClipping.difference(
        [[toClosedRing(tri)]],
        ...touched.map((k) => holeMultis[k])
      );
    } catch {
      out.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      continue;
    }
    if (!result?.length) continue; // fully inside a hole

    for (const polygon of result) {
      if (!polygon?.length) continue;
      const contour = polygon[0].slice(0, -1);
      if (contour.length < 3) continue;
      const innerRings = polygon
        .slice(1)
        .map((ring) => ring.slice(0, -1))
        .filter((ring) => ring.length >= 3);
      // triangulateShape wants a CCW contour and CW holes.
      const contourV = (
        ringArea(contour) < 0 ? contour.slice().reverse() : contour
      ).map(([x, y]) => new Vector2(x, y));
      const holesV = innerRings.map((ring) =>
        (ringArea(ring) > 0 ? ring.slice().reverse() : ring).map(
          ([x, y]) => new Vector2(x, y)
        )
      );
      const all = [...contourV, ...holesV.flat()];
      const faces = ShapeUtils.triangulateShape(contourV, holesV) || [];
      // Keep the source triangle's winding (det sign) so the normals agree.
      const flip = det < 0;
      for (const face of faces) {
        const idx = flip ? [face[0], face[2], face[1]] : face;
        for (const vi of idx) {
          const v = all[vi];
          out.push(v.x, v.y, zAt(v.x, v.y));
        }
      }
    }
  }
  return out;
}
