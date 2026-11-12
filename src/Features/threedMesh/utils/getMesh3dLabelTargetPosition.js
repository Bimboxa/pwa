import computePlaneBasis from "./computePlaneBasis.js";
import { getMesh3dPlanePoint, LABEL_LIFT_M } from "./getMesh3dLabelAnchor.js";
import { getClosestSurfacePoint } from "./getShellSurfacePoint.js";
import { liftPointTo3d, projectLoopTo2d } from "./planeProjection.js";
import pointInPolygon2d from "./pointInPolygon2d.js";
import { add, dot, scale, sub } from "./vec3Utils.js";

// The pointed end ("target") of a maille label leader always sits ON the
// maille surface. Pure helpers (no three.js), world coordinates, working on
// the STORED geometry (`mesh3d.faces` / `mesh3d.shell.positions`) — the
// displayed meshes are lifted along their normal.

// Closest point of the closed 2D loop boundary to p.
function closestPointOnLoop2d(p, loop) {
  let best = null;
  let bestDistSq = Infinity;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[j];
    const b = loop[i];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;
    let t = lenSq > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const q = { x: a.x + abx * t, y: a.y + aby * t };
    const distSq = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = q;
    }
  }
  return best;
}

// Closest point of one planar face (contour minus holes) to p.
function closestPointOnFace(face, p) {
  const contour = face?.contour;
  if (!contour || contour.length < 3) return null;
  const basis = computePlaneBasis(face.normal, contour[0]);
  const d = sub(p, basis.origin);
  const p2d = { x: dot(d, basis.u), y: dot(d, basis.v) };

  const contour2d = projectLoopTo2d(contour, basis);
  const holes2d = (face.holes || [])
    .filter((hole) => hole?.length >= 3)
    .map((hole) => projectLoopTo2d(hole, basis));

  const onMaterial =
    pointInPolygon2d(p2d, contour2d) &&
    !holes2d.some((hole) => pointInPolygon2d(p2d, hole));

  let q2d = p2d;
  if (!onMaterial) {
    let bestDistSq = Infinity;
    for (const loop of [contour2d, ...holes2d]) {
      const q = closestPointOnLoop2d(p2d, loop);
      if (!q) continue;
      const distSq = (q.x - p2d.x) ** 2 + (q.y - p2d.y) ** 2;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        q2d = q;
      }
    }
  }
  return { point: liftPointTo3d(q2d, basis), normal: basis.n };
}

/**
 * Point of the maille surface closest to `p`, with the unit normal the
 * displayed surface is lifted along at that point.
 *
 * @returns {{point: {x,y,z}, normal: {x,y,z}}|null}
 */
export function getMesh3dSurfacePoint(mesh3d, p) {
  if (!mesh3d || !p) return null;
  let best = mesh3d.shell?.positions?.length
    ? getClosestSurfacePoint(mesh3d.shell.positions, p)
    : null;
  let bestDistSq = Infinity;
  if (best) {
    const d = sub(best.point, p);
    bestDistSq = dot(d, d);
  }
  for (const face of mesh3d.faces || []) {
    const hit = closestPointOnFace(face, p);
    if (!hit) continue;
    const d = sub(hit.point, p);
    const distSq = dot(d, d);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = hit;
    }
  }
  return best;
}

// Displayed position of a surface point: lifted off the surface like the
// label anchor, so the handle / leader end never z-fights the maille.
export function liftMesh3dSurfacePoint(surfacePoint) {
  if (!surfacePoint) return null;
  return add(surfacePoint.point, scale(surfacePoint.normal, LABEL_LIFT_M));
}

/**
 * Displayed position of the pointed end of a maille label leader:
 * - nothing hand-placed → the label anchor itself;
 * - `mesh3d.labelTargetPoint` (world point on the surface, written by the
 *   target drag) or the legacy in-plane `mesh3d.labelTargetOffset`, snapped
 *   back to the closest point of the maille surface. Snapping at read time
 *   re-attaches targets that were dragged off the maille before the drag was
 *   constrained, and keeps the target on the surface after a re-mesh.
 *
 * @returns {{x,y,z}|null}
 */
export default function getMesh3dLabelTargetPosition(mesh3d, anchor) {
  if (!anchor) return null;
  const targetPoint = mesh3d?.labelTargetPoint;
  const offset = mesh3d?.labelTargetOffset;
  const hasOffset = Boolean(Number(offset?.u) || Number(offset?.v));
  if (!targetPoint && !hasOffset) return { ...anchor.base };

  const raw = targetPoint
    ? {
        x: Number(targetPoint.x) || 0,
        y: Number(targetPoint.y) || 0,
        z: Number(targetPoint.z) || 0,
      }
    : getMesh3dPlanePoint(anchor, offset);
  return liftMesh3dSurfacePoint(getMesh3dSurfacePoint(mesh3d, raw)) || raw;
}
