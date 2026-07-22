import { Vector3 } from "three";

// Below this the mouse ray is almost parallel to the extrusion axis: the
// helper plane degenerates and the projected value explodes.
const MIN_SIN2 = 1e-3;

// Signed distance (meters) the cursor has travelled along `axis`, measured
// from `anchor` — the SketchUp push/pull value.
//
// The mouse ray is intersected with the plane that contains the axis and is
// as perpendicular to the ray as possible (normal = the ray direction
// component orthogonal to the axis), then the hit is projected back onto the
// axis. Returns null when the view is nearly axis-aligned, so the caller can
// keep the last valid value instead of jumping.
//
// ray: { origin: Vector3, direction: Vector3 (unit) } — raycaster.ray works.
// anchor: Vector3 picked on the face at arm time.
// axis: unit Vector3, the extrusion direction (baseMap normal).
export default function getAxisDragValue({ ray, anchor, axis }) {
  if (!ray?.origin || !ray?.direction || !anchor || !axis) return null;

  const d = ray.direction;
  const dDotAxis = d.dot(axis);
  // n = d − (d·axis)·axis, i.e. the plane normal. |n|² = 1 − (d·axis)².
  const sin2 = 1 - dDotAxis * dDotAxis;
  if (sin2 < MIN_SIN2) return null;

  const n = new Vector3().copy(d).addScaledVector(axis, -dDotAxis).normalize();
  const denom = d.dot(n);
  if (Math.abs(denom) < 1e-6) return null;

  const t = new Vector3().subVectors(anchor, ray.origin).dot(n) / denom;
  if (!Number.isFinite(t)) return null;

  const hit = new Vector3().copy(ray.origin).addScaledVector(d, t);
  return hit.sub(anchor).dot(axis);
}
