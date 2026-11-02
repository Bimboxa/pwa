import getAnnotationStrokeWidthPx from "../../geometry/utils/getAnnotationStrokeWidthPx.js";

/**
 * L / T junction repair between a freshly detected 2-pt segment and the
 * nearby near-orthogonal segments of existing POLYLINE / STRIP annotations
 * (two-point or multi-point, open or closed), thickness-aware.
 *
 * Rule: segment AXES are never moved — only endpoint positions slide along
 * their own axis. The `maxGapPx` threshold applies to the INITIAL distance
 * between the endpoint and the NEAREST band edge of the other segment (the
 * gap to fill or the overshoot to erase) — NOT to the displacement itself
 * (trimming a full band crossing moves the endpoint by gap + band width).
 *  - T: when a candidate endpoint sits within `maxGapPx` of a neighbor
 *    segment's band, it snaps to the near edge + `overlapPx` INSIDE the band.
 *    Any segment of a polyline is a T host, including the closing segment of
 *    a closed one.
 *  - L: when the junction also sits at a FIRST / LAST vertex of an open
 *    neighbor polyline, that vertex slides along the NEIGHBOR axis so its end
 *    lands flush with the candidate's far band edge (clean corner) —
 *    returned as a point edit to persist on commit. Interior vertices
 *    (corners of the neighbor) never move: the junction stays a T.
 *
 * All coordinates in REFERENCE px space.
 */

// Distance from a scalar coordinate to an interval (0 when inside).
function distToRange(x, lo, hi) {
  if (x < lo) return lo - x;
  if (x > hi) return x - hi;
  return 0;
}

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

// Band offsets of a POLYLINE / STRIP along the LEFT normal of its path
// direction, in REFERENCE px (same conversions as buildExclusionMask, without
// /imageScale since we stay in ref space). Null when the annotation has no
// physical band.
function getNeighborBand(ann, meterByPx) {
  if (ann.type === "POLYLINE") {
    const sw = ann.strokeWidth ?? 0;
    const w =
      ann.strokeWidthUnit === "CM" && meterByPx > 0
        ? Math.abs((sw * 0.01) / meterByPx)
        : Math.abs(sw);
    if (!(w > 0)) return null;
    return { lo: -w / 2, hi: w / 2 };
  }
  if (ann.type === "STRIP") {
    const w = Math.abs(getAnnotationStrokeWidthPx(ann, meterByPx));
    if (!(w > 0)) return null;
    const o = ann.stripOrientation ?? 1;
    return { lo: Math.min(0, o * w), hi: Math.max(0, o * w) };
  }
  return null;
}

const isFinitePoint = (p) =>
  Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

// Extract the segments of the POLYLINE / STRIP annotations usable as junction
// targets: one neighbor per segment, in path order. `pointIds` names the
// vertex at each end of the segment ONLY when it is a true end of an open
// polyline (first / last vertex) — the only vertices an L corner may move.
// Closed polylines contribute every segment, closing one included, with no
// movable vertex. Hidden segments are skipped; annotations with circle
// points (arcs) are left out.
export function buildJunctionNeighbors(annotations, meterByPx) {
  const out = [];
  for (const ann of annotations || []) {
    if (!ann?.points || ann.points.length < 2) continue;
    if (ann.type !== "POLYLINE" && ann.type !== "STRIP") continue;
    if (ann.points.some((p) => p?.type === "circle")) continue;
    const band = getNeighborBand(ann, meterByPx);
    if (!band) continue;
    const points = ann.points;
    const n = points.length;
    const closed = Boolean(ann.closeLine) && n >= 3;
    const hidden = new Set(ann.hiddenSegmentsIdx || []);
    const segmentCount = closed ? n : n - 1;
    for (let k = 0; k < segmentCount; k++) {
      if (hidden.has(k)) continue;
      const p1 = points[k];
      const p2 = points[(k + 1) % n];
      if (!isFinitePoint(p1) || !isFinitePoint(p2)) continue;
      out.push({
        id: ann.id,
        segmentIndex: k,
        p1: { x: p1.x, y: p1.y },
        p2: { x: p2.x, y: p2.y },
        band,
        pointIds: closed
          ? [null, null]
          : [
              k === 0 ? (p1.id ?? null) : null,
              k === n - 2 ? (p2.id ?? null) : null,
            ],
      });
    }
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

  // How far the candidate band sticks out from its axis — used to widen the
  // junction-position checks along the neighbor axis.
  const bandReach = Math.max(Math.abs(band.lo), Math.abs(band.hi));

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
      if (sX < -(maxGapPx + bandReach) || sX > Lb + maxGapPx + bandReach)
        continue;

      // Neighbor band edges measured along the CANDIDATE axis.
      const m = { x: -v.y, y: v.x };
      const mu = m.x * u.x + m.y * u.y; // ≈ ±1 (near-orthogonal)
      const eA = aX + nb.band.lo * mu;
      const eB = aX + nb.band.hi * mu;
      const bandA = { lo: Math.min(eA, eB), hi: Math.max(eA, eB) };
      // Trigger on the INITIAL distance from the endpoint to the nearest
      // band edge — NOT on the displacement (trimming a full crossing moves
      // the endpoint by up to gap + band width).
      const dist = distToRange(end.a, bandA.lo, bandA.hi);
      if (dist > maxGapPx) continue;
      // Snap target: near edge + overlap INSIDE the band (capped mid-band).
      const mid = (bandA.lo + bandA.hi) / 2;
      const target =
        end.sigma > 0
          ? Math.min(bandA.lo + overlapPx, mid)
          : Math.max(bandA.hi - overlapPx, mid);
      if (!best || dist < best.dist) {
        best = { nb, target, dist, sX, v, Lb };
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
    const isEnd1 = dEnd1 <= dEnd2;
    const movedPointId = nb.pointIds?.[isEnd1 ? 0 : 1];
    if (Math.min(dEnd1, dEnd2) <= maxGapPx + bandReach && movedPointId) {
      const sigmaN = isEnd1 ? -1 : +1; // outward direction of that endpoint
      // Candidate band edges measured along the NEIGHBOR axis.
      const nv = n.x * v.x + n.y * v.y; // ≈ ±1
      const cA = sX + band.lo * nv;
      const cB = sX + band.hi * nv;
      const bandS = { lo: Math.min(cA, cB), hi: Math.max(cA, cB) };
      const sTarget = sigmaN > 0 ? bandS.hi : bandS.lo;
      const sCur = isEnd1 ? 0 : Lb;
      // Same rule as the T case: the threshold applies to the initial
      // distance between the neighbor's endpoint and the candidate band,
      // not to the displacement.
      if (distToRange(sCur, bandS.lo, bandS.hi) <= maxGapPx) {
        const before = isEnd1 ? nb.p1 : nb.p2;
        out.neighborEdits.push({
          annotationId: nb.id,
          pointId: movedPointId,
          x: nb.p1.x + sTarget * v.x,
          y: nb.p1.y + sTarget * v.y,
          before: { x: before.x, y: before.y },
        });
      }
    }
  }
  return out;
}
