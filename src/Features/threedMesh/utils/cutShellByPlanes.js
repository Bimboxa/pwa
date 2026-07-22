import buildShellFromRegion from "./buildShellFromRegion.js";
import cutShellByPlane from "./cutShellByPlane.js";
import getShellCentroid from "./getShellCentroid.js";
import { dot } from "./vec3Utils.js";

// Shell (curved maille) counterpart of cutFacesByPlanes: splits a triangle
// soup by 1 or 2 half-spaces. `inside` is the part on the positive side of
// EVERY plane (the angular-cut wedge), `outside` everything else — the pieces
// each plane rejects, merged back into a single shell.
//
// Pure (no three.js), world coordinates.

const ON_PLANE_TOL = 1e-4;

const toShell = (positions) => {
  if (!positions?.length) return null;
  return buildShellFromRegion({
    positions,
    index: null,
    tris: Array.from({ length: positions.length / 9 }, (_, i) => i),
  });
};

const withCentroid = (shell) =>
  shell
    ? {
        shell,
        surface: shell.surface,
        centroid: getShellCentroid(shell.positions)?.centroid || null,
      }
    : null;

/**
 * @param {object} args
 * @param {ArrayLike<number>} args.positions - flat triangle soup (world)
 * @param {Array<{normal, constant}>} args.planes - 1 or 2 half-spaces
 * @returns {{ inside, outside, segments }} — same shape as cutFacesByPlanes,
 *   with `shell` payloads instead of `faces`.
 */
export default function cutShellByPlanes({ positions, planes }) {
  if (!positions?.length || !planes?.length) return null;

  let insidePositions = Array.from(positions);
  const outsidePositions = [];

  for (const plane of planes) {
    if (!insidePositions.length) break;
    const { positive, negative } = cutShellByPlane({
      positions: insidePositions,
      plane,
    });
    insidePositions = positive ? Array.from(positive.positions) : [];
    if (negative?.positions?.length) {
      outsidePositions.push(...negative.positions);
    }
  }

  const insideShell = toShell(insidePositions);

  // Preview line: the boundary edges of the kept part lying on a cut plane.
  const segments = [];
  for (const loop of insideShell?.boundaries || []) {
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i];
      const q = loop[(i + 1) % loop.length];
      const onPlane = planes.some(
        (plane) =>
          Math.abs(dot(plane.normal, p) - plane.constant) <= ON_PLANE_TOL &&
          Math.abs(dot(plane.normal, q) - plane.constant) <= ON_PLANE_TOL
      );
      if (onPlane) segments.push([p, q]);
    }
  }

  return {
    inside: withCentroid(insideShell),
    outside: withCentroid(toShell(outsidePositions)),
    segments,
  };
}
