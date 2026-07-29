// Reference points of the shell vertical cut guide, as abscissas on the base
// chain (see chainAbscissa.js): the base points of the maille's seams
// (previous cuts) plus, on an open base, its two endpoints. The "Décalage"
// guide measures its développé from the reference nearest to the cursor.
//
// Seam base points are found by segment-to-chain distance, NOT by endpoint
// sampling: a seam carried over from an older cut can cross the chain between
// its own endpoints (its tessellation predates the chain). Seams lying ALONG
// the chain (both endpoints on it) are excluded — when the base ring IS a
// former horizontal cut, its seam segments would otherwise flood the refs.
//
// Pure (no three.js), world coordinates.

import { pointAtChainAbscissa, projectPointToChain } from "./chainAbscissa.js";

const REF_DIST_TOL = 0.01;
const REF_DEDUPE_M = 0.02;

// Closest points between two 3D segments (Ericson, Real-Time Collision
// Detection §5.1.9): returns the squared distance and the parameter `t` of
// the closest point on [p2, q2].
function segSegDistSq(p1, q1, p2, q2) {
  const d1 = { x: q1.x - p1.x, y: q1.y - p1.y, z: q1.z - p1.z };
  const d2 = { x: q2.x - p2.x, y: q2.y - p2.y, z: q2.z - p2.z };
  const r = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
  const dot = (u, v) => u.x * v.x + u.y * v.y + u.z * v.z;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  const EPS = 1e-12;

  let s = 0;
  let t = 0;
  if (a <= EPS && e <= EPS) {
    // both degenerate
  } else if (a <= EPS) {
    t = clamp01(f / e);
  } else {
    const c = dot(d1, r);
    if (e <= EPS) {
      s = clamp01(-c / a);
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      s = denom > EPS ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }

  const c1 = { x: p1.x + d1.x * s, y: p1.y + d1.y * s, z: p1.z + d1.z * s };
  const c2 = { x: p2.x + d2.x * t, y: p2.y + d2.y * t, z: p2.z + d2.z * t };
  const dx = c1.x - c2.x;
  const dy = c1.y - c2.y;
  const dz = c1.z - c2.z;
  return { distSq: dx * dx + dy * dy + dz * dz, t };
}

/**
 * @param {object} args
 * @param {ReturnType<import("./chainAbscissa.js").buildChainMeasure>}
 *   args.measure - base chain measure
 * @param {[[{x,y,z},{x,y,z}]]} [args.seams] - seams carried by the maille
 * @returns {[{s: number, point: {x,y,z}}]} sorted by abscissa, deduped. A
 *   closed chain with no seam returns [] — a virgin ring has no reference,
 *   the first cut is free.
 */
export default function getShellCutRefs({ measure, seams }) {
  if (!measure) return [];
  const { points, closed, cum, total } = measure;
  const n = points.length;
  const segCount = closed ? n : n - 1;
  const tolSq = REF_DIST_TOL * REF_DIST_TOL;

  const refs = [];
  for (const [a, b] of seams || []) {
    const projA = projectPointToChain(measure, a);
    const projB = projectPointToChain(measure, b);
    if (projA.distSq <= tolSq && projB.distSq <= tolSq) continue; // along it

    let best = null;
    for (let i = 0; i < segCount; i++) {
      const segLen = cum[i + 1] - cum[i];
      if (segLen <= 0) continue;
      const { distSq, t } = segSegDistSq(a, b, points[i], points[(i + 1) % n]);
      if (!best || distSq < best.distSq) {
        best = { distSq, s: cum[i] + t * segLen };
      }
    }
    if (!best || best.distSq > tolSq) continue;
    refs.push({ s: best.s });
  }

  if (!closed) {
    refs.push({ s: 0 });
    refs.push({ s: total });
  }
  if (!refs.length) return [];

  refs.sort((r1, r2) => r1.s - r2.s);

  const deduped = [];
  for (const ref of refs) {
    const prev = deduped[deduped.length - 1];
    if (prev && ref.s - prev.s < REF_DEDUPE_M) continue;
    deduped.push(ref);
  }
  if (closed && deduped.length > 1) {
    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    if (total - (last.s - first.s) < REF_DEDUPE_M) deduped.pop();
  }

  // Materialize the chain point of each surviving abscissa.
  return deduped.map((ref) => ({
    s: ref.s,
    point: pointAtChainAbscissa(measure, ref.s)?.point || { ...points[0] },
  }));
}
