import { add, dot, scale, sub } from "./vec3Utils.js";

// Projection between 3D world space and the 2D (u, v) coordinates of a plane
// basis built by computePlaneBasis.

export function projectPointTo2d(p, basis) {
  const d = sub(p, basis.origin);
  return { x: dot(d, basis.u), y: dot(d, basis.v) };
}

export function projectLoopTo2d(loop, basis) {
  return loop.map((p) => projectPointTo2d(p, basis));
}

export function liftPointTo3d(p, basis) {
  return add(basis.origin, add(scale(basis.u, p.x), scale(basis.v, p.y)));
}

export function liftLoopTo3d(loop, basis) {
  return loop.map((p) => liftPointTo3d(p, basis));
}
