// Display split of a cut line segment against the revolutions shown as a
// display-only half (« demi-vue »): the cut lines run over the full turn of
// the real object, the part lying on a hidden half is drawn dashed.
//
// hosts: [{ point, normal, triangles, box }] in the frame of a / b (see
// collectHalfViewHosts) — the half-space dot(p - point, normal) ≥ 0 is
// displayed, `triangles` (9 numbers each) is the hidden half, `box` its
// bounds.
//
// The segment is cut where it crosses a boundary plane; a piece is on a
// hidden half when its middle lies on the hidden side of a host AND on its
// hidden surface (a line drawn on the ground under the hidden half stays
// solid).
//
// Returns [{ t0, t1, hiddenHalf }] covering [0, 1] in order (parameters
// along a → b), neighbours with the same flag merged.
//
// Pure: node-testable.

const SIDE_EPS_M = 1e-3;
const SURFACE_TOL_M = 1e-2;
const MIN_PIECE_T = 1e-6;

const side = (p, host) =>
  (p.x - host.point.x) * host.normal.x +
  (p.y - host.point.y) * host.normal.y +
  (p.z - host.point.z) * host.normal.z;

const lerp = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

function isInBox(p, box, tol) {
  if (!box) return true;
  return (
    p.x >= box.min.x - tol &&
    p.x <= box.max.x + tol &&
    p.y >= box.min.y - tol &&
    p.y <= box.max.y + tol &&
    p.z >= box.min.z - tol &&
    p.z <= box.max.z + tol
  );
}

// Squared distance from p to the triangle at offset o of `t` (closest point
// on a triangle, Ericson, Real-Time Collision Detection 5.1.5).
function distanceSqToTriangle(p, t, o) {
  const ax = t[o];
  const ay = t[o + 1];
  const az = t[o + 2];
  const abx = t[o + 3] - ax;
  const aby = t[o + 4] - ay;
  const abz = t[o + 5] - az;
  const acx = t[o + 6] - ax;
  const acy = t[o + 7] - ay;
  const acz = t[o + 8] - az;
  const apx = p.x - ax;
  const apy = p.y - ay;
  const apz = p.z - az;
  const sq = (x, y, z) => x * x + y * y + z * z;

  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return sq(apx, apy, apz);

  const bpx = apx - abx;
  const bpy = apy - aby;
  const bpz = apz - abz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return sq(bpx, bpy, bpz);

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return sq(apx - abx * v, apy - aby * v, apz - abz * v);
  }

  const cpx = apx - acx;
  const cpy = apy - acy;
  const cpz = apz - acz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return sq(cpx, cpy, cpz);

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return sq(apx - acx * w, apy - acy * w, apz - acz * w);
  }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return sq(
      bpx - (acx - abx) * w,
      bpy - (acy - aby) * w,
      bpz - (acz - abz) * w
    );
  }

  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return sq(
    apx - abx * v - acx * w,
    apy - aby * v - acy * w,
    apz - abz * v - acz * w
  );
}

function isOnSurface(p, triangles, tol) {
  const tolSq = tol * tol;
  for (let o = 0; o + 8 < triangles.length; o += 9) {
    if (distanceSqToTriangle(p, triangles, o) <= tolSq) return true;
  }
  return false;
}

function isOnHiddenHalf(p, host, tol) {
  if (side(p, host) > -SIDE_EPS_M) return false;
  if (!isInBox(p, host.box, tol)) return false;
  return isOnSurface(p, host.triangles || [], tol);
}

export default function splitCutLineSegmentByHalfView(
  a,
  b,
  hosts,
  { tolerance = SURFACE_TOL_M } = {}
) {
  if (!hosts?.length) return [{ t0: 0, t1: 1, hiddenHalf: false }];

  const cuts = [0, 1];
  for (const host of hosts) {
    const sa = side(a, host);
    const sb = side(b, host);
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) {
      const t = sa / (sa - sb);
      if (t > MIN_PIECE_T && t < 1 - MIN_PIECE_T) cuts.push(t);
    }
  }
  cuts.sort((x, y) => x - y);

  const pieces = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const t0 = cuts[i];
    const t1 = cuts[i + 1];
    if (t1 - t0 < MIN_PIECE_T) continue;
    const mid = lerp(a, b, (t0 + t1) / 2);
    const hiddenHalf = hosts.some((host) =>
      isOnHiddenHalf(mid, host, tolerance)
    );
    const last = pieces[pieces.length - 1];
    if (last && last.hiddenHalf === hiddenHalf) last.t1 = t1;
    else pieces.push({ t0, t1, hiddenHalf });
  }
  if (!pieces.length) return [{ t0: 0, t1: 1, hiddenHalf: false }];
  pieces[0].t0 = 0;
  pieces[pieces.length - 1].t1 = 1;
  return pieces;
}
