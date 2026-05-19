// Geometric wall vectorization variant.
//
// The filled polygons of a plan already contain every wall edge: the white
// gap between two facing, anti-parallel polygon edges (outer rings or cut
// rings) that sit < maxWallThicknessM apart IS a wall. Its centerline is the
// midline of that gap and its thickness is the gap width. This avoids any
// image processing — it works purely on the drawn polygon geometry.

import projectPointOnSegment from "Features/annotations/utils/projectPointOnSegment";
import mergePolylines from "./mergePolylines";
import { expandArcsInPath } from "./arcSampling";

const ARC_SAMPLES = 12;
const COS_ANG = Math.cos((12 * Math.PI) / 180); // anti-parallel / opposite-normal tolerance

function signedArea2(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s;
}

function tOnLine(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-12) return 0;
  return ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
}

function lerp(a, b, t) {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function polylineLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return L;
}

// Intersection of the two infinite lines (p1,p2) and (p3,p4); null if parallel.
function lineLineIntersection(p1, p2, p3, p4) {
  const r = { x: p2.x - p1.x, y: p2.y - p1.y };
  const s = { x: p4.x - p3.x, y: p4.y - p3.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p3.x - p1.x) * s.y - (p3.y - p1.y) * s.x) / denom;
  return { x: p1.x + t * r.x, y: p1.y + t * r.y };
}

// Parallel pairing truncates each arm midline by ~half a wall thickness at a
// corner, so mergePolylines bridges the two arms with a short spurious diagonal.
// Replace such a bridge with the true intersection of the two extended arms,
// producing a clean mitred corner. Only fires when the bridge is short, the
// arms are clearly non-parallel, and the computed corner stays near the bridge
// (so genuine oblique walls and arc tessellation chords are left untouched).
function healCorners(points, maxBridgePx) {
  if (points.length < 4) return points;
  const angTol = Math.cos((20 * Math.PI) / 180);
  const reach = maxBridgePx * 1.5;
  const pts = points.slice();
  let i = 1;
  while (i <= pts.length - 3) {
    const P0 = pts[i - 1];
    const P1 = pts[i];
    const P2 = pts[i + 1];
    const P3 = pts[i + 2];
    const bridge = Math.hypot(P2.x - P1.x, P2.y - P1.y);
    const armPrev = Math.hypot(P1.x - P0.x, P1.y - P0.y);
    const armNext = Math.hypot(P3.x - P2.x, P3.y - P2.y);
    if (
      bridge > 1e-6 &&
      bridge < maxBridgePx &&
      armPrev > 2 * bridge &&
      armNext > 2 * bridge
    ) {
      const dpx = (P1.x - P0.x) / armPrev;
      const dpy = (P1.y - P0.y) / armPrev;
      const dnx = (P3.x - P2.x) / armNext;
      const dny = (P3.y - P2.y) / armNext;
      const cosA = dpx * dnx + dpy * dny;
      if (Math.abs(cosA) < angTol) {
        const X = lineLineIntersection(P0, P1, P2, P3);
        if (
          X &&
          Math.hypot(X.x - P1.x, X.y - P1.y) <= reach &&
          Math.hypot(X.x - P2.x, X.y - P2.y) <= reach
        ) {
          pts.splice(i, 2, { x: X.x, y: X.y });
          continue;
        }
      }
    }
    i += 1;
  }
  return pts;
}

function collectRingSegments(ringPts, isCut, polyIdx, epsLenPx, out) {
  if (!ringPts || ringPts.length < 3) return;
  const ring = expandArcsInPath(ringPts, ARC_SAMPLES, true);
  const N = ring.length;
  if (N < 3) return;

  const sgn = signedArea2(ring) >= 0 ? 1 : -1;
  // Outward (gap-facing) normal points away from the solid. The solid is
  // inside an outer ring but outside a cut ring (hole), hence the flip.
  const nSign = isCut ? -sgn : sgn;

  for (let k = 0; k < N; k++) {
    const A = ring[k];
    const B = ring[(k + 1) % N];
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const L = Math.hypot(dx, dy);
    if (L < epsLenPx) continue;
    const dir = { x: dx / L, y: dy / L };
    const n = { x: (nSign * dy) / L, y: (nSign * -dx) / L };
    out.push({ A, B, dir, n, L, polyIdx });
  }
}

/**
 * @param {Object} args
 * @param {Array<{points:Array<{x,y,id?,type?}>, cuts?:Array<{points:Array}>}>} args.polygons
 *   source polygons in pixel space.
 * @param {number} args.meterByPx image scale (m/px).
 * @param {number} [args.maxWallThicknessM=1] max gap width considered a wall.
 * @returns {Array<{pointsPx:Array<{x,y}>, thicknessPx:number}>}
 */
export default function computeWallPolylinesFromPolygonSegments({
  polygons,
  meterByPx,
  maxWallThicknessM = 1,
}) {
  if (!polygons || polygons.length < 1) {
    console.warn(
      "[computeWallPolylinesFromPolygonSegments] need >=1 polygon, got",
      polygons?.length
    );
    return [];
  }
  if (!(meterByPx > 0)) {
    console.warn(
      "[computeWallPolylinesFromPolygonSegments] invalid meterByPx",
      meterByPx
    );
    return [];
  }

  const thresholdPx = maxWallThicknessM / meterByPx;
  const epsLenPx = Math.max(1, 0.02 * thresholdPx);
  // thresholdPx = max ALLOWED wall thickness (maxWallThicknessM / meterByPx).
  // On a small-scale plan it can be far larger than the actual wall, so it
  // must ONLY gate the gap distance. The longitudinal-overlap minimum and the
  // piece-dedup grid stay at the (small) chord scale — otherwise a thin or
  // curved wall, whose midline is many short pieces (~one per arc chord), has
  // all its pieces rejected/deduped and no wall is produced.
  const minOverlapPx = Math.max(2, epsLenPx);
  const dedupPx = Math.max(2, epsLenPx);
  const snapPx = Math.max(6, 0.2 * thresholdPx);
  const thickTolPx = Math.max(2, 0.15 * thresholdPx);

  // 1. Collect every segment (outer rings + cut rings) with its outward normal.
  const segs = [];
  for (let i = 0; i < polygons.length; i++) {
    const poly = polygons[i];
    collectRingSegments(poly?.points, false, i, epsLenPx, segs);
    if (poly?.cuts) {
      for (const cut of poly.cuts) {
        collectRingSegments(cut?.points, true, i, epsLenPx, segs);
      }
    }
  }

  // 2. Pair anti-parallel facing segments → midline pieces.
  const pieces = [];
  const seen = new Set();
  const keyFor = (m0, m1) => {
    const a = `${Math.round(m0.x / dedupPx)},${Math.round(m0.y / dedupPx)}`;
    const b = `${Math.round(m1.x / dedupPx)},${Math.round(m1.y / dedupPx)}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  };

  for (let i = 0; i < segs.length; i++) {
    const Sa = segs[i];
    for (let j = i + 1; j < segs.length; j++) {
      const Sb = segs[j];

      if (Sa.dir.x * Sb.dir.x + Sa.dir.y * Sb.dir.y >= -COS_ANG) continue;
      if (Sa.n.x * Sb.n.x + Sa.n.y * Sb.n.y >= -COS_ANG) continue;

      // Longitudinal overlap of Sb projected onto Sa's line. Computed first so
      // the gap is measured inside the shared span: with multiple input
      // polygons the two facing edges often differ greatly in length, and a
      // full-segment midpoint of the longer edge projects outside the shorter
      // one (projectPointOnSegment clamps to an endpoint and returns an
      // inflated distance, which used to spuriously reject the pair).
      const tb0 = tOnLine(Sb.A, Sa.A, Sa.B);
      const tb1 = tOnLine(Sb.B, Sa.A, Sa.B);
      const tLo = Math.max(0, Math.min(tb0, tb1));
      const tHi = Math.min(1, Math.max(tb0, tb1));
      if (tHi <= tLo || (tHi - tLo) * Sa.L < minOverlapPx) continue;

      // Sample the perpendicular gap at both ends and the middle of the
      // overlap. These points lie within Sb by construction, so the distances
      // are true gaps (no endpoint clamping).
      const Pa0 = lerp(Sa.A, Sa.B, tLo);
      const Pa1 = lerp(Sa.A, Sa.B, tHi);
      const Pam = lerp(Sa.A, Sa.B, (tLo + tHi) / 2);
      const p0 = projectPointOnSegment(Pa0, Sb.A, Sb.B);
      const p1 = projectPointOnSegment(Pa1, Sb.A, Sb.B);
      const pm = projectPointOnSegment(Pam, Sb.A, Sb.B);
      const d0 = p0.distance;
      const d1 = p1.distance;
      const dm = pm.distance;

      const gap = (d0 + d1 + dm) / 3;
      if (!(gap > epsLenPx && gap < thresholdPx)) continue;
      // Gap must stay roughly constant across the overlap (rejects
      // non-parallel pairs — the real intent of the old |dA - dB| test).
      if (Math.max(d0, d1, dm) - Math.min(d0, d1, dm) > 0.3 * thresholdPx)
        continue;

      // Facing: Sb must lie on the gap side of Sa (along Sa's outward normal).
      const fvx = pm.projectedPoint.x - Pam.x;
      const fvy = pm.projectedPoint.y - Pam.y;
      if (fvx * Sa.n.x + fvy * Sa.n.y <= 0) continue;

      // 3. Midline piece over the common interval.
      const M0 = mid(Pa0, p0.projectedPoint);
      const M1 = mid(Pa1, p1.projectedPoint);
      if (Math.hypot(M1.x - M0.x, M1.y - M0.y) < epsLenPx) continue;

      // 4. Dedup (a subdivided segment can match the same opposite edge twice).
      const k = keyFor(M0, M1);
      if (seen.has(k)) continue;
      seen.add(k);

      pieces.push({ a: M0, b: M1, thicknessPx: gap });
    }
  }

  if (pieces.length === 0) return [];

  // 5. Chain pieces into polylines, bucketed by thickness so a thin wall and a
  //    thick wall meeting at a junction stay separate polylines.
  const buckets = new Map();
  for (const p of pieces) {
    const bk = Math.round(p.thicknessPx / thickTolPx);
    if (!buckets.has(bk)) buckets.set(bk, []);
    buckets.get(bk).push(p);
  }

  const walls = [];
  for (const bucketPieces of buckets.values()) {
    let wSum = 0;
    let wLen = 0;
    for (const p of bucketPieces) {
      const len = Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y);
      wSum += p.thicknessPx * len;
      wLen += len;
    }
    const bucketThickness =
      wLen > 0 ? wSum / wLen : bucketPieces[0].thicknessPx;

    const list = bucketPieces.map((p) => [
      { x: p.a.x, y: p.a.y },
      { x: p.b.x, y: p.b.y },
    ]);
    const maxBridgePx = Math.max(snapPx, 1.5 * bucketThickness);
    const groups = mergePolylines(list, snapPx * snapPx);
    for (const group of groups) {
      if (!group || group.length < 2) continue;
      const healed = healCorners(
        group.map((pt) => ({ x: pt.x, y: pt.y })),
        maxBridgePx
      );
      // A real wall is at least about as long as it is thick — keeps short
      // partitions while dropping tiny spurious fragments. Threshold-
      // independent (see the minOverlapPx / dedupPx note above).
      if (polylineLength(healed) < Math.max(8, bucketThickness)) continue;
      walls.push({ pointsPx: healed, thicknessPx: bucketThickness });
    }
  }

  console.log(
    `[computeWallPolylinesFromPolygonSegments] ${segs.length} segments, ${pieces.length} pieces -> ${walls.length} wall polylines`
  );
  return walls;
}
