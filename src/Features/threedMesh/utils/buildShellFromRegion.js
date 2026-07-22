import extractBoundaryLoops3d from "./extractBoundaryLoops3d.js";
import { cross, length, sub } from "./vec3Utils.js";

// Curved ("coque") maille payload: the region's triangles kept as-is, plus its
// boundary loops. A curved surface cannot be a planar polygon, and turning it
// into one planar face per facet would mean hundreds of records per maille —
// so the shell IS the storage.
//
// A 360° revolution has two boundary circles and no outer contour, so the
// loops stay unclassified (no contour/holes split).
//
// Pure (no three.js): positions come in already transformed to world space by
// buildMeshDataFromRegion, which owns the three.js side.

/**
 * @param {object} args
 * @param {ArrayLike<number>} args.positions - flat xyz array (WORLD coords)
 * @param {ArrayLike<number>|null} args.index - triangle index, or null (soup)
 * @param {number[]} args.tris - triangle indices of the region
 * @returns {{positions: number[], boundaries: [[{x,y,z}]], surface: number} | null}
 *   `positions` is a flat triangle soup (9 numbers per triangle), `surface` is
 *   the developed area (m²).
 */
export default function buildShellFromRegion({ positions, index, tris }) {
  if (!positions || !tris?.length) return null;

  const vertIndex = index ? (t, c) => index[3 * t + c] : (t, c) => 3 * t + c;
  const getPos = (vi) => ({
    x: positions[3 * vi],
    y: positions[3 * vi + 1],
    z: positions[3 * vi + 2],
  });

  const out = new Array(9 * tris.length);
  let offset = 0;
  let surface = 0;
  for (const t of tris) {
    const a = getPos(vertIndex(t, 0));
    const b = getPos(vertIndex(t, 1));
    const c = getPos(vertIndex(t, 2));
    surface += length(cross(sub(b, a), sub(c, a))) / 2;
    for (const p of [a, b, c]) {
      out[offset++] = p.x;
      out[offset++] = p.y;
      out[offset++] = p.z;
    }
  }

  const boundary = extractBoundaryLoops3d({ positions, index, tris });

  return {
    positions: out,
    boundaries: boundary?.loops || [],
    surface,
  };
}
