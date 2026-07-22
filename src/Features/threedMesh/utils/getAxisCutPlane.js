import { dot } from "./vec3Utils.js";

// World plane of an axis cut (CUT_VERTICAL / CUT_HORIZONTAL) whose position
// was resolved in the hovered face's 2D basis (reference vertex, "Décalage"
// guide, mid-edge snap). Turning it into a world plane is what lets the cut
// reach the OTHER facets of a multi-face maille.
//
// The plane always holds the cut line of the hovered face, so a single-face
// maille cuts exactly as before:
//
// - axis "x" (vertical tool): the cut line is at constant u. `u` is always
//   horizontal (computePlaneBasis builds it perpendicular to the in-plane
//   vertical), so the plane is vertical, as the tool promises.
// - axis "y" (horizontal tool): the cut line is at constant v. On a sloped or
//   vertical face v has a vertical component, and since u is horizontal the
//   points at v = cutPos all share the same world Y: the plane is the LEVEL
//   plane through the cut line. On a (near-)horizontal face v is horizontal
//   too — the level plane would swallow the whole face, so the plane
//   perpendicular to it through the line is used instead.
export default function getAxisCutPlane(basis, axis, cutPos) {
  if (axis === "x") {
    return {
      normal: basis.u,
      constant: cutPos + dot(basis.u, basis.origin),
    };
  }
  if (basis.isHorizontalFace || Math.abs(basis.v.y) < 1e-6) {
    return {
      normal: basis.v,
      constant: cutPos + dot(basis.v, basis.origin),
    };
  }
  return {
    normal: { x: 0, y: 1, z: 0 },
    constant: basis.origin.y + cutPos * basis.v.y,
  };
}
