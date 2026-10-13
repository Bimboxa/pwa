import buildShellFromRegion from "../../threedMesh/utils/buildShellFromRegion.js";
import cutShellByPlaneNear from "../../threedMesh/utils/cutShellByPlaneNear.js";
import {
  add,
  cross,
  dot,
  length,
  normalize,
  scale,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";

// « Découpe horizontale / verticale » of a SURFACE host (isSurfaceCutHost:
// lathe, shell, swept profile): the cut plane through the hovered point of
// the surface piece under the cursor, and its trace on that piece.
//
// Plane (user decisions, 2026-10-13):
// - H: the world horizontal plane (normal = up), like a planar face and like
//   the mailles.
// - V on a revolution: the MERIDIAN plane — it holds the revolution axis and
//   the hovered point, so the cut runs along a generatrix.
// - V on a shell without axis: the mailles' convention (meshingCutController
//   getShellCutNormal) — a vertical plane holding the line of sight, a knife
//   held facing the user.
// The V normal is turned toward the viewer's right so the LEFT / RIGHT side
// (S) reads on screen.
//
// Reference ("Hauteur / Distance de coupe", like computeFaceAxisCut on a
// planar face): the piece's boundary vertex furthest AGAINST the cut
// direction — the lowest one for H, the leftmost (rightmost on the RIGHT
// side) for V; the typed distance locks the plane that far from it, else the
// plane goes through the cursor and snaps on the boundary vertices'
// coordinates along the normal (never on the extremal ones: a plane there
// does not cut).
//
// Trace = cutShellByPlaneNear: only the chain of crossed facets holding the
// hovered point (a plane meets a wrapped surface in several places), pieces
// = connected components (an opened ring stays one piece).
//
// Pure (no three.js), world coordinates — node-testable.

const UP = { x: 0, y: 1, z: 0 };
// Hovered point this close to the revolution axis: no meridian.
const AXIS_EPS_M = 1e-3;
// A boundary coordinate this close to an extremal one is extremal too.
const EXTREMAL_TOL_M = 1e-6;

/**
 * @param {object} args
 * @param {"H"|"V"} args.axis
 * @param {{x,y,z}} args.hitPoint - hovered point (world)
 * @param {{x,y,z}} args.viewDir - line of sight at the hit (world, unit)
 * @param {{point: {x,y,z}, dir: {x,y,z}} | null} [args.revolutionAxis] -
 *   the host's revolution axis (world), when it has one
 * @returns {{x,y,z} | null} unit normal, or null when degenerate
 */
export function getSurfaceCutNormal({
  axis,
  hitPoint,
  viewDir,
  revolutionAxis,
}) {
  if (axis === "H") return { ...UP };
  let normal;
  if (revolutionAxis?.point && revolutionAxis?.dir) {
    const dir = normalize(revolutionAxis.dir);
    const rel = sub(hitPoint, revolutionAxis.point);
    const radial = sub(rel, scale(dir, dot(rel, dir)));
    if (!(length(radial) > AXIS_EPS_M)) return null;
    normal = normalize(cross(dir, radial));
  } else {
    if (!viewDir) return null;
    normal = normalize(cross(UP, viewDir));
  }
  if (!(length(normal) > 0.5)) return null;
  // Screen-left / right reading of the side: the normal points to the
  // viewer's right.
  if (viewDir) {
    const right = cross(viewDir, UP);
    if (length(right) > 1e-6 && dot(normal, right) < 0) {
      normal = scale(normal, -1);
    }
  }
  return normal;
}

/**
 * Boundary vertices of a surface piece (flat triangle soup).
 */
export function getSurfaceBoundaryPoints(positions) {
  const triCount = Math.floor((positions?.length || 0) / 9);
  if (!triCount) return [];
  const shell = buildShellFromRegion({
    positions,
    index: null,
    tris: Array.from({ length: triCount }, (_, i) => i),
  });
  return (shell?.boundaries || []).flat();
}

/**
 * @param {object} args
 * @param {ArrayLike<number>} args.positions - the hovered piece, flat
 *   triangle soup (world)
 * @param {[{x,y,z}]} [args.boundaryPoints] - its boundary vertices (computed
 *   when omitted)
 * @param {{x,y,z}} args.hitPoint - hovered point (world)
 * @param {"H"|"V"} args.axis
 * @param {"LEFT"|"RIGHT"} [args.side]
 * @param {{x,y,z}} [args.viewDir]
 * @param {{point, dir} | null} [args.revolutionAxis]
 * @param {number|null} [args.typedDistance] - m, locks the plane
 * @param {number | ((normal) => number)} [args.snapToleranceM]
 * @returns {{plane: {normal, constant}, segments: [[p, q]], pieces,
 *   ref: {x,y,z}, guide: {x,y,z}, distance: number, snapped: boolean,
 *   locked: boolean} | null} — null when the plane misses the piece
 */
export default function computeSurfaceAxisCut({
  positions,
  boundaryPoints,
  hitPoint,
  axis,
  side = "LEFT",
  viewDir,
  revolutionAxis = null,
  typedDistance = null,
  snapToleranceM = 0,
}) {
  if (!positions?.length || !hitPoint) return null;
  const normal = getSurfaceCutNormal({
    axis,
    hitPoint,
    viewDir,
    revolutionAxis,
  });
  if (!normal) return null;
  const dir = axis === "H" ? 1 : side === "RIGHT" ? -1 : 1;

  const boundary = boundaryPoints ?? getSurfaceBoundaryPoints(positions);
  if (boundary.length < 2) return null;
  const dists = boundary.map((p) => dot(normal, p));
  let refIndex = 0;
  let minD = Infinity;
  let maxD = -Infinity;
  dists.forEach((d, i) => {
    if (dir * d < dir * dists[refIndex]) refIndex = i;
    if (d < minD) minD = d;
    if (d > maxD) maxD = d;
  });
  const ref = boundary[refIndex];
  const refDist = dists[refIndex];

  let constant;
  let locked = false;
  let snapped = false;
  if (Number.isFinite(typedDistance) && typedDistance !== null) {
    constant = refDist + dir * typedDistance;
    locked = true;
  } else {
    constant = dot(normal, hitPoint);
    const tol =
      typeof snapToleranceM === "function"
        ? snapToleranceM(normal)
        : snapToleranceM;
    if (tol > 0) {
      let best = null;
      for (const d of dists) {
        if (d - minD < EXTREMAL_TOL_M || maxD - d < EXTREMAL_TOL_M) continue;
        const gap = Math.abs(d - constant);
        if (gap <= tol && (best === null || gap < Math.abs(best - constant))) {
          best = d;
        }
      }
      if (best !== null) {
        constant = best;
        snapped = true;
      }
    }
  }

  const plane = { normal, constant };
  const cut = cutShellByPlaneNear({ positions, plane, hitPoint });
  if (!cut) return null;

  return {
    plane,
    segments: cut.segments,
    pieces: cut.pieces,
    ref,
    guide: add(ref, scale(normal, constant - refDist)),
    distance: Math.abs(constant - refDist),
    snapped,
    locked,
  };
}
