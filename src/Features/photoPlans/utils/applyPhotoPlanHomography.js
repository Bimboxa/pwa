import { mat3ApplyToPoint } from "./mat3";

// Map one point through a photoPlan homography (or its inverse).
// Input space depends on the matrix: H expects NORMALIZED photo coords and
// returns meters; Hinv the other way around.
//
// Returns {x, y} or null when the point lies on / beyond the horizon
// (homogeneous w not strictly positive — H is sign-normalized so the valid
// side of the horizon has w > 0).

const EPS = 1e-9;

export default function applyPhotoPlanHomography(H, point) {
  if (!H || !point) return null;
  const { x, y, w } = mat3ApplyToPoint(H, point);
  if (!(w > EPS * (Math.abs(x) + Math.abs(y) + 1))) return null;
  return { x: x / w, y: y / w };
}
