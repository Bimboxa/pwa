import {
  dot,
  length,
  normalize,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";

import {
  computeFaceBasis,
  getFaceNewellNormal,
  projectPoint,
} from "./meshPaintGeometry.js";

// Which island of a planar region holds the brush hit point: a plane-mode
// region of a carved geometry may hold several disjoint islands
// (buildMeshDataFromRegion faces), only the one under the cursor is painted.
//
// 1. faces whose projected polygon (minus holes) contains the projected
//    point — the one whose plane is the nearest wins;
// 2. fallback (the hit lands on a boundary, float noise): the face nearest
//    to the point (plane distance ⊕ distance to its contour / holes).
//
// faces: [{contour: V[], holes: V[][], normal: V}] in any consistent frame.
// Returns the face index, -1 when there is no face.
//
// Pure: node-testable.

function pointInRing([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distToRing([px, py], ring) {
  let best = Infinity;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % n];
    const ex = bx - ax;
    const ey = by - ay;
    const lenSq = ex * ex + ey * ey;
    let t = lenSq > 0 ? ((px - ax) * ex + (py - ay) * ey) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(px - (ax + t * ex), py - (ay + t * ey));
    if (d < best) best = d;
  }
  return best;
}

/**
 * Projected location of a point on a planar polygon with holes.
 * @returns {{planeDist: number, inside: boolean, boundaryDist: number} | null}
 */
export function locatePointOnPlanarFace(face, point) {
  const origin = face?.contour?.[0];
  if (!origin || face.contour.length < 3) return null;
  let n = face.normal ? normalize(face.normal) : null;
  if (!n || length(n) === 0) {
    n = getFaceNewellNormal({ polygons: [{ contour: face.contour }] });
  }
  if (!n) return null;
  const basis = computeFaceBasis(n, origin);
  const p2 = projectPoint(point, basis);
  const contour = face.contour.map((p) => projectPoint(p, basis));
  const holes = (face.holes || [])
    .filter((hole) => hole?.length >= 3)
    .map((hole) => hole.map((p) => projectPoint(p, basis)));
  const inside =
    pointInRing(p2, contour) && !holes.some((hole) => pointInRing(p2, hole));
  const boundaryDist = Math.min(
    distToRing(p2, contour),
    ...holes.map((hole) => distToRing(p2, hole))
  );
  return {
    planeDist: Math.abs(dot(sub(point, origin), n)),
    inside,
    boundaryDist,
  };
}

export default function pickFaceContainingPoint(faces, point) {
  if (!faces?.length || !point) return -1;
  let bestInside = -1;
  let bestInsideDist = Infinity;
  let bestNear = -1;
  let bestNearDist = Infinity;
  faces.forEach((face, index) => {
    const where = locatePointOnPlanarFace(face, point);
    if (!where) return;
    if (where.inside && where.planeDist < bestInsideDist) {
      bestInsideDist = where.planeDist;
      bestInside = index;
    }
    const d = where.inside
      ? where.planeDist
      : Math.hypot(where.planeDist, where.boundaryDist);
    if (d < bestNearDist) {
      bestNearDist = d;
      bestNear = index;
    }
  });
  return bestInside >= 0 ? bestInside : bestNear;
}
