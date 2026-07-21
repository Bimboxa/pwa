import polygonClipping from "polygon-clipping";

import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

// Stairs layout derived from a guideLine flagged `isStairs`: N nosing lines
// (one per step, the first at the low end of the flight) transverse to the
// guide line and clipped to the polygon outline (holes included), plus the
// tread bands used to build the stepped 3D surface. Single source of truth
// shared by the 2D renderer (nosing strokes), the 3D stairs builder and the
// quantities (nez linear + risers surface).
//
// Conventions (mirroring the ramp model):
//   - deltaH = slopePct/100 × L2D × meterByPx (signed); riserH = |deltaH| / N.
//   - Low end = drawing start when slopePct >= 0, reversed otherwise (same
//     rule as the slope arrow / getGuideLineRampSampler).
//   - Nosing i sits at arc length s_i = i·L/N from the LOW end (i = 0..N-1).
//   - Tread i spans [s_i, s_(i+1)] with top Z = (i+1)·riserH; riser i spans
//     Z [i·riserH, (i+1)·riserH]. Z = 0 is the flight's approach floor.
//
// v1 limitations: uniform tread depth L/N (no winders/landings); tread bands
// are exact for straight guide lines, approximate near polyline curvature;
// innerPoints are ignored.
//
// Inputs (pixel space, resolved points):
//   - guideLine:  { points: [{x,y,type?}], slopePct, isStairs, stairsCount }
//   - polygonPts: outer ring [{x,y,type?}]
//   - cuts:       optional cut rings [[{x,y,type?}]]
//   - meterByPx:  optional px→m scale; when absent all meter fields are 0
//                 (the 2D renderer only needs pixel segments).
//
// Returns null when degenerate, else {
//   count, deltaH, riserH, L2D,
//   nosings: [{ index, s, segments: [{a,b}], lengthPx, lengthM, zLow, zHigh }],
//   treads:  [{ index, s0, s1, z }],
//   bands:   [{ z, quad }] — treads quads + a leading floor band (z=0) for
//            the polygon region before the first nosing,
//   bandPolysAt(k) — polygon ∩ bands[k].quad as a polygon-clipping MultiPolygon.
// }

const EPS = 1e-9;

export function isStairsGuideLine(g) {
  return Boolean(g?.isStairs) && (g?.points?.length ?? 0) >= 2;
}

export function findStairsGuideLine(guideLines) {
  if (!Array.isArray(guideLines)) return null;
  return guideLines.find(isStairsGuideLine) || null;
}

// cross(a, b) with {x,y} vectors.
function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

// Even-odd point-in-rings test over the outer ring + holes together.
function isInsideRings(point, rings) {
  let inside = false;
  for (const ring of rings) {
    const n = ring.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = ring[i];
      const b = ring[j];
      const intersects =
        a.y > point.y !== b.y > point.y &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (intersects) inside = !inside;
    }
  }
  return inside;
}

// Intersections of the infinite line P + u·dir with a closed ring, as sorted
// `u` parameters. Half-open edge parameter v ∈ [0,1) so shared vertices are
// counted once.
function lineRingIntersections(P, dir, ring, out) {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const denom = cross(dir.x, dir.y, dx, dy);
    if (Math.abs(denom) < EPS) continue; // parallel edge
    const apx = a.x - P.x;
    const apy = a.y - P.y;
    const u = cross(apx, apy, dx, dy) / denom;
    const v = cross(apx, apy, dir.x, dir.y) / denom;
    if (v >= 0 && v < 1) out.push(u);
  }
}

export default function getGuideLineStairsLayout({
  guideLine,
  polygonPts,
  cuts,
  meterByPx,
}) {
  if (!isStairsGuideLine(guideLine)) return null;

  const count = Math.max(1, Math.round(Number(guideLine.stairsCount) || 1));
  const slopePct = Number(guideLine.slopePct) || 0;

  // --- Spine (arc-expanded), walked from the LOW end ---
  let spine = expandArcsInPath(guideLine.points, 16, false)
    .filter((p) => typeof p?.x === "number" && typeof p?.y === "number")
    .map((p) => ({ x: p.x, y: p.y }));
  if (spine.length < 2) return null;
  if (slopePct < 0) spine = spine.slice().reverse();

  const cum = [0];
  for (let i = 0; i < spine.length - 1; i++) {
    cum.push(
      cum[i] +
        Math.hypot(spine[i + 1].x - spine[i].x, spine[i + 1].y - spine[i].y)
    );
  }
  const L2D = cum[cum.length - 1];
  if (!Number.isFinite(L2D) || L2D < 1e-6) return null;

  // Segment index at arc length s (clamped).
  const segAt = (s) => {
    const t = Math.max(0, Math.min(L2D, s));
    let i = 0;
    while (i < cum.length - 2 && cum[i + 1] < t) i++;
    return { i, t };
  };
  const at = (s) => {
    const { i, t } = segAt(s);
    const seg = cum[i + 1] - cum[i] || 1;
    const f = (t - cum[i]) / seg;
    return {
      x: spine[i].x + (spine[i + 1].x - spine[i].x) * f,
      y: spine[i].y + (spine[i + 1].y - spine[i].y) * f,
    };
  };
  const tangentAt = (s) => {
    const { i } = segAt(s);
    const dx = spine[i + 1].x - spine[i].x;
    const dy = spine[i + 1].y - spine[i].y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  };

  // --- Polygon rings (arc-expanded, same sampling as qties/3D) ---
  const toRing = (pts) =>
    expandArcsInPath(pts || [], 6, true)
      .filter((p) => typeof p?.x === "number" && typeof p?.y === "number")
      .map((p) => ({ x: p.x, y: p.y }));
  const outerRing = toRing(polygonPts);
  if (outerRing.length < 3) return null;
  const cutRings = (cuts || []).map(toRing).filter((r) => r.length >= 3);
  const allRings = [outerRing, ...cutRings];

  const scale = Number.isFinite(meterByPx) && meterByPx > 0 ? meterByPx : 0;
  const deltaH = (slopePct / 100) * L2D * scale;
  const riserH = Math.abs(deltaH) / count;

  // --- Nosings: perpendicular chords clipped to the polygon (even-odd) ---
  // The first nosing (s = 0) usually coincides with the polygon's low edge:
  // sampling exactly on the boundary breaks the crossing parity (collinear
  // edge + shared vertices), so chords are sampled a hair inside the flight.
  const sEps = Math.min(L2D * 1e-4, 0.01);
  const nosings = [];
  for (let i = 0; i < count; i++) {
    const s = (i * L2D) / count;
    const sSample = Math.min(Math.max(s, sEps), L2D - sEps);
    const P = at(sSample);
    const t = tangentAt(sSample);
    const normal = { x: -t.y, y: t.x };

    const us = [];
    for (const ring of allRings) lineRingIntersections(P, normal, ring, us);
    us.sort((a, b) => a - b);

    const segments = [];
    let lengthPx = 0;
    for (let k = 0; k + 1 < us.length; k += 2) {
      const u0 = us[k];
      const u1 = us[k + 1];
      const len = u1 - u0;
      if (len < 1e-6) continue;
      const mid = {
        x: P.x + normal.x * (u0 + u1) * 0.5,
        y: P.y + normal.y * (u0 + u1) * 0.5,
      };
      // Robustness guard against parity glitches at tangent vertices.
      if (!isInsideRings(mid, allRings)) continue;
      segments.push({
        a: { x: P.x + normal.x * u0, y: P.y + normal.y * u0 },
        b: { x: P.x + normal.x * u1, y: P.y + normal.y * u1 },
      });
      lengthPx += len;
    }

    nosings.push({
      index: i,
      s,
      segments,
      lengthPx,
      lengthM: lengthPx * scale,
      zLow: i * riserH,
      zHigh: (i + 1) * riserH,
    });
  }

  // --- Treads + bands (3D) ---
  const treads = [];
  for (let i = 0; i < count; i++) {
    treads.push({
      index: i,
      s0: (i * L2D) / count,
      s1: ((i + 1) * L2D) / count,
      z: (i + 1) * riserH,
    });
  }

  // Band quads bounded by the perpendicular lines at s0 / s1. Half-width and
  // the outward extensions (floor band before the first nosing, top landing
  // beyond the guide end) are sized from the ring bbox so the polygon is
  // always covered.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of outerRing) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const extent = 2 * (Math.hypot(maxX - minX, maxY - minY) + L2D) + 10;

  const bandQuad = (s0, s1, extendStart, extendEnd) => {
    const p0 = at(Math.max(0, s0));
    const p1 = at(Math.min(L2D, s1));
    const t0 = tangentAt(s0);
    const t1 = tangentAt(s1);
    const n0 = { x: -t0.y, y: t0.x };
    const n1 = { x: -t1.y, y: t1.x };
    const a0 = extendStart
      ? { x: p0.x - t0.x * extent, y: p0.y - t0.y * extent }
      : p0;
    const a1 = extendEnd
      ? { x: p1.x + t1.x * extent, y: p1.y + t1.y * extent }
      : p1;
    return [
      [a0.x + n0.x * extent, a0.y + n0.y * extent],
      [a0.x - n0.x * extent, a0.y - n0.y * extent],
      [a1.x - n1.x * extent, a1.y - n1.y * extent],
      [a1.x + n1.x * extent, a1.y + n1.y * extent],
    ];
  };

  // bands[0] = approach floor (z=0) covering any polygon region before the
  // first nosing; bands[1..N] = treads (last one extended past the guide end
  // so a top landing stays at the top tread level).
  const bands = [{ z: 0, quad: bandQuad(0, 0, true, false) }];
  treads.forEach((tread, i) => {
    bands.push({
      z: tread.z,
      quad: bandQuad(tread.s0, tread.s1, false, i === count - 1),
    });
  });

  const polygonGeom = [
    [
      outerRing.map((p) => [p.x, p.y]),
      ...cutRings.map((r) => r.map((p) => [p.x, p.y])),
    ],
  ];

  const bandPolysAt = (k) => {
    const band = bands[k];
    if (!band) return [];
    try {
      return polygonClipping.intersection(polygonGeom, [[band.quad]]) || [];
    } catch (error) {
      console.error(
        "[getGuideLineStairsLayout] polygon-clipping error:",
        error
      );
      return [];
    }
  };

  return { count, deltaH, riserH, L2D, nosings, treads, bands, bandPolysAt };
}
