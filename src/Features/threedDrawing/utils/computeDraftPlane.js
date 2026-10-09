import { Vector3 } from "three";

// Collinear points: the polygon's area is under this fraction of its extent
// squared (a 1 mm wide sliver over 1 m).
const MIN_AREA_RATIO = 1e-3;

// Newell's method over ALL vertices — a first-triplet cross product
// degenerates when the first three clicks are collinear (common when tracing
// along a straight wall). Returns the unit normal, or null when degenerate.
export function computeNewellNormal(vertices) {
  if (!vertices || vertices.length < 3) return null;
  const n = new Vector3();
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    n.x += (a.y - b.y) * (a.z + b.z);
    n.y += (a.z - b.z) * (a.x + b.x);
    n.z += (a.x - b.x) * (a.y + b.y);
  }
  if (n.lengthSq() < 1e-12) return null;
  return n.normalize();
}

// Plane of a polygon being drawn, once it has 3+ non-collinear points: the
// plane the next points are locked on. Through the first point, Newell
// normal. Null with fewer than 3 points or when they are (nearly) collinear.
//
// Returns { point: Vector3, normal: Vector3 } or null — the `lockedPlane`
// shape of computeSnapTarget.
export default function computeDraftPlane(points) {
  if (!points || points.length < 3) return null;
  const raw = new Vector3();
  let extentSq = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    raw.x += (a.y - b.y) * (a.z + b.z);
    raw.y += (a.z - b.z) * (a.x + b.x);
    raw.z += (a.x - b.x) * (a.y + b.y);
    for (let j = i + 1; j < points.length; j++) {
      const c = points[j];
      const d =
        (a.x - c.x) * (a.x - c.x) +
        (a.y - c.y) * (a.y - c.y) +
        (a.z - c.z) * (a.z - c.z);
      if (d > extentSq) extentSq = d;
    }
  }
  // |raw| = twice the polygon area.
  if (extentSq < 1e-12 || raw.length() / 2 < MIN_AREA_RATIO * extentSq) {
    return null;
  }
  const first = points[0];
  return {
    point: new Vector3(first.x, first.y, first.z),
    normal: raw.normalize(),
  };
}
