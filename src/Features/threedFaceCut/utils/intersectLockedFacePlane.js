import computePlaneBasis from "../../threedMesh/utils/computePlaneBasis.js";
import pointInPolygon2d from "../../threedMesh/utils/pointInPolygon2d.js";
import { projectPointTo2d } from "../../threedMesh/utils/planeProjection.js";
import {
  add,
  dot,
  normalize,
  scale,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";

// Default slack (m) around the face outline for the `inside` test: a point
// snapped on a border edge sits on the outline, a cursor just off it still
// counts as on the face.
export const INSIDE_TOL_M = 0.01;

function distToLoop(p, loop) {
  let best = Infinity;
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % n];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const lenSq = ex * ex + ey * ey;
    let t = lenSq > 0 ? ((p.x - a.x) * ex + (p.y - a.y) * ey) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(p.x - (a.x + t * ex), p.y - (a.y + t * ey));
    if (d < best) best = d;
  }
  return best;
}

// The cursor ray against the plane of a LOCKED face (the face the "Coupe
// face" tools are bound to while it is selected): the point where the ray
// meets the plane, with whether it lies on the face itself.
//
//   ray:  { origin, direction } (world, direction unit)
//   face: { point, normal, loops } — a point of the plane, the face's
//         OUTWARD unit normal, the face loops [contour, ...holes] in world
//         coordinates
//   options.doubleSided: the back side of the face may be hit too (an open
//         mesh — its winding is not normalized —, or a clipping plane
//         exposing the inside of a solid). A closed solid is otherwise
//         refused from behind, like the scene raycast never hits it there.
//   options.isVisible(point): false when the point is clipped away.
//   options.insideTolM: slack (m) around the outline for `inside`.
//
// Returns { position, normal, distance, inside } or null when the ray misses
// the plane (parallel, plane behind the camera, back side, clipped). `normal`
// is the plane normal turned toward the camera (the convention of
// intersectAnnotationFace, which getFaceCutBasisWorld relies on).
//
// Pure (no three.js): node-testable.
export default function intersectLockedFacePlane(
  ray,
  face,
  { doubleSided = false, isVisible = null, insideTolM = INSIDE_TOL_M } = {}
) {
  if (!ray?.origin || !ray?.direction || !face?.point || !face?.normal) {
    return null;
  }
  const normal = normalize(face.normal);
  const denom = dot(ray.direction, normal);
  if (Math.abs(denom) < 1e-9) return null;
  // Looking at the back of the face.
  if (denom > 0 && !doubleSided) return null;
  const distance = dot(sub(face.point, ray.origin), normal) / denom;
  if (distance < 0) return null;
  const position = add(ray.origin, scale(ray.direction, distance));
  if (isVisible && !isVisible(position)) return null;

  let inside = true;
  if (face.loops?.[0]?.length >= 3) {
    const basis = computePlaneBasis(normal, face.point);
    const loops2d = face.loops.map((loop) =>
      loop.map((p) => projectPointTo2d(p, basis))
    );
    const p = projectPointTo2d(position, basis);
    const [contour, ...holes] = loops2d;
    inside =
      pointInPolygon2d(p, contour) &&
      !holes.some((h) => pointInPolygon2d(p, h));
    if (!inside) {
      inside =
        Math.min(...loops2d.map((loop) => distToLoop(p, loop))) <= insideTolM;
    }
  }

  return {
    position,
    normal: denom > 0 ? scale(normal, -1) : normal,
    distance,
    inside,
  };
}
