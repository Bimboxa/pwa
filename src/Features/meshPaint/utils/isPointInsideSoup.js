// Is a point inside a closed triangle soup? Ray parity (odd crossing count =
// inside), cast along three skewed, irrational-ish directions and decided by
// majority: a ray grazing a shared edge / vertex (counted twice or not at
// all) only spoils one vote. The third ray is only cast when the first two
// disagree. Triangle winding is irrelevant; coincident duplicated triangles
// (internal partitions of abutting pieces) cancel out.
//
// point: {x, y, z}; triangles: flat xyz array, 9 numbers per triangle, same
// frame as the point. Meaningless on an open soup.
//
// createInsideSoupTester(triangles) precomputes the soup once for many
// probes (buildHostPartIndex orients every island with one).
//
// Pure: node-testable.

const RAW_DIRECTIONS = [
  [0.5257, 0.3139, 0.7906],
  [-0.6427, 0.5446, -0.5389],
  [0.2104, -0.8577, 0.4691],
];

const DIRECTIONS = RAW_DIRECTIONS.map(([x, y, z]) => {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
});

const PARALLEL_EPS = 1e-12;
const T_EPS = 1e-9;

// Per triangle: vertex a, edges e1 = b - a, e2 = c - a (9 numbers).
function prepare(triangles) {
  const triCount = Math.floor((triangles?.length || 0) / 9);
  const data = new Float64Array(9 * triCount);
  for (let t = 0; t < triCount; t++) {
    const o = 9 * t;
    const ax = Number(triangles[o]);
    const ay = Number(triangles[o + 1]);
    const az = Number(triangles[o + 2]);
    data[o] = ax;
    data[o + 1] = ay;
    data[o + 2] = az;
    data[o + 3] = triangles[o + 3] - ax;
    data[o + 4] = triangles[o + 4] - ay;
    data[o + 5] = triangles[o + 5] - az;
    data[o + 6] = triangles[o + 6] - ax;
    data[o + 7] = triangles[o + 7] - ay;
    data[o + 8] = triangles[o + 8] - az;
  }
  return { data, triCount };
}

// Möller–Trumbore crossing parity along one direction.
function isOddCrossing(px, py, pz, [dx, dy, dz], { data, triCount }) {
  let count = 0;
  for (let t = 0; t < triCount; t++) {
    const o = 9 * t;
    const e1x = data[o + 3];
    const e1y = data[o + 4];
    const e1z = data[o + 5];
    const e2x = data[o + 6];
    const e2y = data[o + 7];
    const e2z = data[o + 8];
    // q = d × e2
    const qx = dy * e2z - dz * e2y;
    const qy = dz * e2x - dx * e2z;
    const qz = dx * e2y - dy * e2x;
    const det = e1x * qx + e1y * qy + e1z * qz;
    if (det > -PARALLEL_EPS && det < PARALLEL_EPS) continue;
    const inv = 1 / det;
    const sx = px - data[o];
    const sy = py - data[o + 1];
    const sz = pz - data[o + 2];
    const u = (sx * qx + sy * qy + sz * qz) * inv;
    if (u < 0 || u > 1) continue;
    // r = s × e1
    const rx = sy * e1z - sz * e1y;
    const ry = sz * e1x - sx * e1z;
    const rz = sx * e1y - sy * e1x;
    const v = (dx * rx + dy * ry + dz * rz) * inv;
    if (v < 0 || u + v > 1) continue;
    const dist = (e2x * rx + e2y * ry + e2z * rz) * inv;
    if (dist > T_EPS) count++;
  }
  return count % 2 === 1;
}

function testPoint(point, soup) {
  if (!point || !soup.triCount) return false;
  const { x, y, z } = point;
  const first = isOddCrossing(x, y, z, DIRECTIONS[0], soup);
  const second = isOddCrossing(x, y, z, DIRECTIONS[1], soup);
  if (first === second) return first;
  return isOddCrossing(x, y, z, DIRECTIONS[2], soup);
}

/**
 * @param {ArrayLike<number>} triangles - 9 numbers per triangle
 * @returns {(point: {x, y, z}) => boolean}
 */
export function createInsideSoupTester(triangles) {
  const soup = prepare(triangles);
  return (point) => testPoint(point, soup);
}

export default function isPointInsideSoup(point, triangles) {
  if (!point) return false;
  return testPoint(point, prepare(triangles));
}
