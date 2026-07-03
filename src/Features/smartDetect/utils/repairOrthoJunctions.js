/**
 * L / T junction repair between a freshly detected 2-pt segment and nearby
 * near-orthogonal 2-pt POLYLINE / STRIP annotations, thickness-aware.
 *
 * Rule: segment AXES are never moved — only endpoint positions slide along
 * their own axis:
 *  - T: when a candidate endpoint lands within `maxGapPx` of a neighbor's
 *    band edge (a gap to fill or an overshoot to erase), it snaps to that
 *    edge + `overlapPx` INSIDE the band.
 *  - L: when the junction also sits within `maxGapPx` of one of the
 *    neighbor's own endpoints, that endpoint slides along the NEIGHBOR axis
 *    so its end lands flush with the candidate's far band edge (clean
 *    corner) — returned as a point edit to persist on commit.
 *
 * All coordinates in REFERENCE px space.
 */

const ORTHO_DOT_MAX = 0.26; // ~15° off perpendicular still counts

// p + a·u = q + s·v → { a, s }, or null when near-parallel.
function intersectAxes(p, u, q, v) {
  const cross = u.x * v.y - u.y * v.x;
  if (Math.abs(cross) < 1e-6) return null;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  return {
    a: (dx * v.y - dy * v.x) / cross,
    s: (dx * u.y - dy * u.x) / cross,
  };
}

// Extract the 2-pt POLYLINE / STRIP annotations usable as junction targets.
// Widths are converted to REFERENCE px (same conversions as
// buildExclusionMask, without /imageScale since we stay in ref space).
export function buildJunctionNeighbors(annotations, meterByPx) {
  const out = [];
  for (const ann of annotations || []) {
    if (!ann?.points || ann.points.length !== 2) continue;
    let band = null;
    if (ann.type === "POLYLINE" && !ann.closeLine) {
      const sw = ann.strokeWidth ?? 0;
      const w =
        ann.strokeWidthUnit === "CM" && meterByPx > 0
          ? Math.abs((sw * 0.01) / meterByPx)
          : Math.abs(sw);
      if (!(w > 0)) continue;
      band = { lo: -w / 2, hi: w / 2 };
    } else if (ann.type === "STRIP") {
      const w = Math.abs(ann.stripWidthPx ?? ann.width ?? 0);
      if (!(w > 0)) continue;
      const o = ann.stripOrientation ?? 1;
      band = { lo: Math.min(0, o * w), hi: Math.max(0, o * w) };
    } else {
      continue;
    }
    const [p1, p2] = ann.points;
    if (
      !Number.isFinite(p1?.x) ||
      !Number.isFinite(p1?.y) ||
      !Number.isFinite(p2?.x) ||
      !Number.isFinite(p2?.y)
    ) {
      continue;
    }
    out.push({
      id: ann.id,
      p1: { x: p1.x, y: p1.y },
      p2: { x: p2.x, y: p2.y },
      band,
      pointIds: [p1.id, p2.id],
    });
  }
  return out;
}

export default function repairOrthoJunctions({
  q1,
  q2,
  band, // candidate band offsets { lo, hi } along its normal (-w/2..w/2, or one-sided for STRIP)
  anchoredStart = false, // never move q1 (user-placed anchor)
  neighbors,
  maxGapPx,
  overlapPx,
}) {
  const out = { q1: { ...q1 }, q2: { ...q2 }, neighborEdits: [] };
  const L = Math.hypot(q2.x - q1.x, q2.y - q1.y);
  if (!(L > 0) || !(maxGapPx > 0) || !neighbors?.length) return out;
  const u = { x: (q2.x - q1.x) / L, y: (q2.y - q1.y) / L };
  const n = { x: -u.y, y: u.x };

  // Candidate endpoints as a-coordinates along u (origin q1).
  const ends = [
    ...(anchoredStart ? [] : [{ a: 0, sigma: -1, key: "q1" }]),
    { a: L, sigma: +1, key: "q2" },
  ];

  for (const end of ends) {
    let best = null;
    for (const nb of neighbors) {
      const Lb = Math.hypot(nb.p2.x - nb.p1.x, nb.p2.y - nb.p1.y);
      if (!(Lb > 0)) continue;
      const v = { x: (nb.p2.x - nb.p1.x) / Lb, y: (nb.p2.y - nb.p1.y) / Lb };
      if (Math.abs(u.x * v.x + u.y * v.y) > ORTHO_DOT_MAX) continue;
      const hit = intersectAxes(q1, u, nb.p1, v);
      if (!hit) continue;
      const { a: aX, s: sX } = hit;
      // The junction must land on (or just past, for L corners) the
      // neighbor's axial span.
      if (sX < -maxGapPx || sX > Lb + maxGapPx) continue;

      // Neighbor band edges measured along the CANDIDATE axis.
      const m = { x: -v.y, y: v.x };
      const mu = m.x * u.x + m.y * u.y; // ≈ ±1 (near-orthogonal)
      const eA = aX + nb.band.lo * mu;
      const eB = aX + nb.band.hi * mu;
      const bandA = { lo: Math.min(eA, eB), hi: Math.max(eA, eB) };
      // Snap target: near edge + overlap INSIDE the band (capped mid-band).
      const mid = (bandA.lo + bandA.hi) / 2;
      const target =
        end.sigma > 0
          ? Math.min(bandA.lo + overlapPx, mid)
          : Math.max(bandA.hi - overlapPx, mid);
      const delta = Math.abs(target - end.a);
      if (delta > maxGapPx) continue;
      if (!best || delta < best.delta) {
        best = { nb, target, delta, sX, v, Lb };
      }
    }
    if (!best) continue;

    // T: slide the candidate endpoint along its own axis.
    out[end.key] = {
      x: q1.x + best.target * u.x,
      y: q1.y + best.target * u.y,
    };

    // L: the junction is near one of the neighbor's own endpoints → slide
    // that endpoint (along the NEIGHBOR axis) so the corner closes flush
    // with the candidate's far band edge.
    const { sX, v, Lb, nb } = best;
    const dEnd1 = Math.abs(sX);
    const dEnd2 = Math.abs(Lb - sX);
    if (
      Math.min(dEnd1, dEnd2) <= maxGapPx &&
      nb.pointIds?.[0] &&
      nb.pointIds?.[1]
    ) {
      const isEnd1 = dEnd1 <= dEnd2;
      const sigmaN = isEnd1 ? -1 : +1; // outward direction of that endpoint
      // Candidate band edges measured along the NEIGHBOR axis.
      const nv = n.x * v.x + n.y * v.y; // ≈ ±1
      const cA = sX + band.lo * nv;
      const cB = sX + band.hi * nv;
      const bandS = { lo: Math.min(cA, cB), hi: Math.max(cA, cB) };
      const sTarget = sigmaN > 0 ? bandS.hi : bandS.lo;
      const sCur = isEnd1 ? 0 : Lb;
      if (Math.abs(sTarget - sCur) <= maxGapPx) {
        out.neighborEdits.push({
          pointId: nb.pointIds[isEnd1 ? 0 : 1],
          x: nb.p1.x + sTarget * v.x,
          y: nb.p1.y + sTarget * v.y,
        });
      }
    }
  }
  return out;
}
