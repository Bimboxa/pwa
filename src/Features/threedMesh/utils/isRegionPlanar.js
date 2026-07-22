import { cross, dot, length, normalize, sub } from "./vec3Utils.js";

// Is a triangle region flat enough to be stored as a planar maille face?
//
// getFaceRegion now grows across facets up to the "Sélection de face" angle,
// so a region can be curved (a revolution, a profile swept along a curve).
// Planar regions keep the historical polygon model (contour + holes, cut
// tools, splits); curved ones are stored as a triangulated shell.
//
// Pure (no three.js), mesh-LOCAL coordinates.

// Max angle (radians) between a triangle normal and the region's area-weighted
// average normal — ~0.06°, i.e. float32 noise only.
const NORMAL_TOL_RAD = 1e-3;

// Max distance (meters) of a vertex to the average plane. Same order as the
// 0.1 mm vertex weld used everywhere else.
const PLANE_DIST_TOL = 1e-4;

/**
 * @param {object} args
 * @param {ArrayLike<number>} args.positions - flat xyz array
 * @param {ArrayLike<number>|null} args.index - triangle index, or null (soup)
 * @param {number[]} args.tris - triangle indices of the region
 * @returns {boolean}
 */
export default function isRegionPlanar({ positions, index, tris }) {
  if (!positions || !tris?.length) return false;
  if (tris.length === 1) return true;

  const vertIndex = index ? (t, c) => index[3 * t + c] : (t, c) => 3 * t + c;
  const getPos = (vi) => ({
    x: positions[3 * vi],
    y: positions[3 * vi + 1],
    z: positions[3 * vi + 2],
  });

  // Area-weighted average normal (the cross product length IS twice the area,
  // so summing the raw cross products weights by area for free).
  let sum = { x: 0, y: 0, z: 0 };
  const triNormals = [];
  for (const t of tris) {
    const a = getPos(vertIndex(t, 0));
    const b = getPos(vertIndex(t, 1));
    const c = getPos(vertIndex(t, 2));
    const n = cross(sub(b, a), sub(c, a));
    sum = { x: sum.x + n.x, y: sum.y + n.y, z: sum.z + n.z };
    triNormals.push(length(n) > 0 ? normalize(n) : null);
  }
  if (length(sum) === 0) return false;
  const avg = normalize(sum);

  const cosTol = Math.cos(NORMAL_TOL_RAD);
  for (const n of triNormals) {
    if (!n) continue; // degenerate triangle: no normal to compare
    if (dot(n, avg) < cosTol) return false;
  }

  // Same normal everywhere is not enough (parallel planes): check the offset.
  const d0 = dot(avg, getPos(vertIndex(tris[0], 0)));
  for (const t of tris) {
    for (let c = 0; c < 3; c++) {
      if (Math.abs(dot(avg, getPos(vertIndex(t, c))) - d0) > PLANE_DIST_TOL) {
        return false;
      }
    }
  }
  return true;
}
