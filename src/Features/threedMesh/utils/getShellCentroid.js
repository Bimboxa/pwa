import { cross, length, normalize, sub } from "./vec3Utils.js";

// Area-weighted centroid + average normal of a shell triangle soup (world
// coords). Used to anchor the maille label and the cut area chips on a curved
// maille, where "the largest face" has no meaning.
//
// Pure (no three.js).
export default function getShellCentroid(positions) {
  if (!positions || positions.length < 9) return null;

  const at = (i) => ({
    x: positions[3 * i],
    y: positions[3 * i + 1],
    z: positions[3 * i + 2],
  });

  let area = 0;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let t = 0; t < positions.length / 9; t++) {
    const a = at(3 * t);
    const b = at(3 * t + 1);
    const c = at(3 * t + 2);
    const n = cross(sub(b, a), sub(c, a));
    const triArea = length(n) / 2;
    if (triArea === 0) continue;
    area += triArea;
    cx += ((a.x + b.x + c.x) / 3) * triArea;
    cy += ((a.y + b.y + c.y) / 3) * triArea;
    cz += ((a.z + b.z + c.z) / 3) * triArea;
    nx += n.x;
    ny += n.y;
    nz += n.z;
  }
  if (area === 0) return null;

  return {
    centroid: { x: cx / area, y: cy / area, z: cz / area },
    normal: normalize({ x: nx, y: ny, z: nz }),
    area,
  };
}
