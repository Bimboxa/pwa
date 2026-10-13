// Layout lines ("lignes de calepinage") embedded in a POLYGON annotation —
// pure bar geometry.
//
// A layout line is a straight polyline drawn inside a polygon. Bars are
// distributed along it (same tick distribution as the standalone LINEAR_LAYOUT
// annotation, see getLinearLayoutBars). Each bar is the straight line
// orthogonal to the polyline segment carrying the tick, passing through the
// tick point and extended in BOTH directions until the first contact with the
// polygon OUTER contour. Portions of the bar lying inside the polygon holes
// (cuts) are subtracted, so a bar is a list of `pieces`.
//
// Everything is computed in ONE coordinate space (pixels of the resolved
// annotation). Relative imports only: this file runs under `node --test`.

import {
  getLinearLayoutSpacing,
  getLinearLayoutTickOffsets,
} from "./getLinearLayoutBars.js";
import { expandArcsInPath } from "../../geometry/utils/arcSampling.js";

export const LAYOUT_LINE_DEFAULTS = {
  densityMode: "SPACING",
  densityValue: 33,
  densityUnitLabel: "barres/m",
  layoutAlign: "CENTER",
  label: "",
  renderMode: "TICKS",
  color: "#000000",
  // Append the spacing (or bars / m) and the bar count under the label.
  showDensityInLabel: false,
  // Extend the bar distribution beyond the two ends of the line (along the
  // first / last segment) until the bars no longer touch the polygon.
  coverWholeSurface: true,
};

export const LAYOUT_LINE_RENDER_MODES = ["TICKS", "ALL_BARS"];

export const LAYOUT_RING_ARC_SAMPLES = 16;

// Safety cap on the total bar count (on-line ticks are already capped by
// getLinearLayoutTickOffsets; extensions must not run away on a tiny pitch).
const MAX_EXTENDED_BARS = 2000;

const EMPTY_RESULT = Object.freeze({
  polyline: [],
  cum: [0],
  lengthPx: 0,
  lengthM: 0,
  spacingM: null,
  spacingPx: null,
  mid: null,
  bars: [],
  extensions: [],
  barCount: 0,
  totalLengthPx: 0,
  totalLengthM: 0,
});

function isFinitePoint(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

// Resolved (px) annotation → arc-expanded outer ring + cut rings.
export function getLayoutLineRingsPx(annotation) {
  const toRing = (pts) =>
    expandArcsInPath(pts || [], LAYOUT_RING_ARC_SAMPLES, true)
      .filter(isFinitePoint)
      .map((p) => ({ x: p.x, y: p.y }));
  const outerRing = toRing(annotation?.points);
  const cutRings = (annotation?.cuts || [])
    .map((c) => toRing(c?.points))
    .filter((r) => r.length >= 3);
  return { outerRing, cutRings };
}

// --- polyline frame -------------------------------------------------------

function buildPolylineFrame(linePoints) {
  const raw = expandArcsInPath(linePoints || [], LAYOUT_RING_ARC_SAMPLES, false)
    .filter(isFinitePoint)
    .map((p) => ({ x: p.x, y: p.y }));
  // Drop consecutive duplicates (degenerate segments).
  const polyline = [];
  for (const p of raw) {
    const last = polyline[polyline.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1e-9) continue;
    polyline.push(p);
  }
  if (polyline.length < 2) return null;

  const cum = [0];
  for (let i = 0; i < polyline.length - 1; i++) {
    cum.push(
      cum[i] +
        Math.hypot(
          polyline[i + 1].x - polyline[i].x,
          polyline[i + 1].y - polyline[i].y
        )
    );
  }
  const length = cum[cum.length - 1];
  if (!Number.isFinite(length) || length < 1e-6) return null;

  // Segment carrying abscissa s: a tick sitting exactly on an interior vertex
  // uses the INCOMING segment (s = 0 → segment 0).
  const segAt = (s) => {
    let i = 0;
    while (i < cum.length - 2 && cum[i + 1] < s) i++;
    return i;
  };
  const at = (s) => {
    const t = Math.max(0, Math.min(length, s));
    const i = segAt(t);
    const seg = cum[i + 1] - cum[i] || 1;
    const f = (t - cum[i]) / seg;
    return {
      x: polyline[i].x + (polyline[i + 1].x - polyline[i].x) * f,
      y: polyline[i].y + (polyline[i + 1].y - polyline[i].y) * f,
    };
  };
  const tangentAt = (s) => {
    const i = segAt(Math.max(0, Math.min(length, s)));
    const dx = polyline[i + 1].x - polyline[i].x;
    const dy = polyline[i + 1].y - polyline[i].y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  };

  return { polyline, cum, length, at, tangentAt };
}

// --- ring helpers (ported from getGuideLineStairsLayout) ------------------

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

// Intersections of the infinite line P + u·dir (dir unit) with a closed ring,
// pushed as `u` parameters. Half-open edge parameter v ∈ [0,1) so shared
// vertices are counted once. Parallel edges are skipped — except COLLINEAR
// ones (within eps), whose two endpoints are pushed as candidates: the
// half-open rule would otherwise lose the vertex shared with the collinear
// edge, and the chord along a contour edge would vanish.
function lineRingIntersections(P, dir, ring, out, eps) {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const edgeLen = Math.hypot(dx, dy);
    if (edgeLen < 1e-12) continue;
    const apx = a.x - P.x;
    const apy = a.y - P.y;
    const denom = cross(dir.x, dir.y, dx, dy);
    if (Math.abs(denom) < 1e-9 * edgeLen) {
      // parallel edge: collinear when `a` lies on the line
      if (Math.abs(cross(dir.x, dir.y, apx, apy)) <= eps) {
        out.push(apx * dir.x + apy * dir.y);
        out.push((b.x - P.x) * dir.x + (b.y - P.y) * dir.y);
      }
      continue;
    }
    const u = cross(apx, apy, dx, dy) / denom;
    const v = cross(apx, apy, dir.x, dir.y) / denom;
    if (v >= 0 && v < 1) out.push(u);
  }
}

function pointInRing(point, ring) {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToRing(point, ring) {
  let best = Infinity;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    let t = 0;
    if (l2 > 0) {
      t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
    }
    const d = Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
    if (d < best) best = d;
  }
  return best;
}

// Inside OR on the boundary (within eps) — keeps the chords collinear with a
// contour edge (their midpoint sits exactly on the boundary).
function isInsideOrOnRing(point, ring, eps) {
  return pointInRing(point, ring) || distanceToRing(point, ring) <= eps;
}

// Pieces [{u0,u1}] of the line P + u·dir lying inside `ring`. Every
// consecutive pair of (sorted, deduped) crossings is classified by its
// midpoint — never by index parity, which breaks at tangent vertices.
function insidePiecesAlongLine(P, dir, ring, eps) {
  const us = [];
  lineRingIntersections(P, dir, ring, us, eps);
  if (us.length < 2) return [];
  us.sort((a, b) => a - b);
  const deduped = [];
  for (const u of us) {
    if (deduped.length && Math.abs(u - deduped[deduped.length - 1]) < eps)
      continue;
    deduped.push(u);
  }
  const pieces = [];
  for (let k = 0; k < deduped.length - 1; k++) {
    const u0 = deduped[k];
    const u1 = deduped[k + 1];
    if (u1 - u0 <= eps) continue;
    const um = (u0 + u1) / 2;
    const M = { x: P.x + dir.x * um, y: P.y + dir.y * um };
    if (!isInsideOrOnRing(M, ring, eps)) continue;
    const last = pieces[pieces.length - 1];
    if (last && Math.abs(last.u1 - u0) <= eps) last.u1 = u1;
    else pieces.push({ u0, u1 });
  }
  return pieces;
}

// Interval difference: intervals \ holes (both sorted lists of {u0,u1}).
function subtractIntervals(intervals, holes) {
  let result = intervals;
  for (const h of holes) {
    const next = [];
    for (const iv of result) {
      if (h.u1 <= iv.u0 || h.u0 >= iv.u1) {
        next.push(iv);
        continue;
      }
      if (h.u0 > iv.u0) next.push({ u0: iv.u0, u1: h.u0 });
      if (h.u1 < iv.u1) next.push({ u0: h.u1, u1: iv.u1 });
    }
    result = next;
  }
  return result;
}

function bboxDiagonal(ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of ring) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

// --- main -----------------------------------------------------------------

// Bar through P along dir, clipped to the rings.
//   - hostOnly: keep the outer piece containing u = 0 only (first contact in
//     both directions — concave re-entries ignored); none when P is outside.
//   - otherwise: every inside piece along the whole line.
// Holes are subtracted in both cases. Returns null when nothing is left.
function computeBar(P, dir, { outerRing, rings, uEps, hostOnly }) {
  const outerPieces = insidePiecesAlongLine(P, dir, outerRing, uEps);
  let intervals;
  if (hostOnly) {
    const host = outerPieces.find((p) => p.u0 - uEps <= 0 && 0 <= p.u1 + uEps);
    if (!host) return null;
    intervals = [host];
  } else {
    intervals = outerPieces;
  }
  if (intervals.length === 0) return null;
  for (const ring of rings) {
    const holePieces = insidePiecesAlongLine(P, dir, ring, uEps);
    if (holePieces.length) intervals = subtractIntervals(intervals, holePieces);
  }
  const pieces = intervals
    .filter((iv) => iv.u1 - iv.u0 > uEps)
    .map((iv) => ({
      u0: iv.u0,
      u1: iv.u1,
      a: { x: P.x + dir.x * iv.u0, y: P.y + dir.y * iv.u0 },
      b: { x: P.x + dir.x * iv.u1, y: P.y + dir.y * iv.u1 },
    }));
  if (!pieces.length) return null;
  const lengthPx = pieces.reduce((acc, p) => acc + (p.u1 - p.u0), 0);
  return { point: P, dir, pieces, lengthPx };
}

// All inputs in px. Returns:
//   {
//     polyline, cum, lengthPx, lengthM, spacingM, spacingPx,
//     mid: { point, angleDeg },          // label anchor (L/2) + tangent angle
//     bars: [{ index, t, extended, point, dir, pieces: [{u0,u1,a,b}], lengthPx, lengthM }],
//     extensions: [{ a, b }],            // dashed axis extensions (coverWholeSurface)
//     barCount, totalLengthPx, totalLengthM,
//   }
// Bars are sorted by `t` (abscissa along the line; negative / > length for
// the extended ones). Never throws: an empty result (bars: []) is returned
// when the line, the scale, the density or the contour is unusable.
export default function computeLayoutLineBars({
  linePoints,
  outerRing,
  cutRings = [],
  meterByPx,
  densityMode,
  densityValue,
  layoutAlign,
  coverWholeSurface = false,
}) {
  const frame = buildPolylineFrame(linePoints);
  if (!frame) return EMPTY_RESULT;

  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  const base = {
    polyline: frame.polyline,
    cum: frame.cum,
    lengthPx: frame.length,
    lengthM: hasScale ? frame.length * meterByPx : 0,
    mid: (() => {
      const t = frame.tangentAt(frame.length / 2);
      return {
        point: frame.at(frame.length / 2),
        angleDeg: (Math.atan2(t.y, t.x) * 180) / Math.PI,
      };
    })(),
  };

  const spacingM = getLinearLayoutSpacing({ densityMode, densityValue });
  if (!hasScale || !(spacingM > 0)) {
    return { ...EMPTY_RESULT, ...base, spacingM };
  }
  const spacingPx = spacingM / meterByPx;

  if (!Array.isArray(outerRing) || outerRing.length < 3) {
    return { ...EMPTY_RESULT, ...base, spacingM, spacingPx };
  }

  const offsets = getLinearLayoutTickOffsets({
    length: frame.length,
    spacing: spacingPx,
    align: layoutAlign,
  });

  const diag = bboxDiagonal(outerRing);
  const uEps = Math.max(1e-7, diag * 1e-6);
  const rings = (cutRings || []).filter(
    (r) => Array.isArray(r) && r.length >= 3
  );
  const clipOpts = { outerRing, rings, uEps, hostOnly: !coverWholeSurface };

  const bars = [];

  // 1. Ticks on the line.
  for (const s of offsets) {
    const tg = frame.tangentAt(s);
    const bar = computeBar(frame.at(s), { x: -tg.y, y: tg.x }, clipOpts);
    if (bar) bars.push({ ...bar, t: s, extended: false });
  }

  // 2. Extensions beyond both ends (coverWholeSurface): walk along the
  // first / last segment direction at the same pitch until a bar misses the
  // polygon (or the bbox is left / the tick cap is hit).
  const extensions = [];
  if (coverWholeSurface && offsets.length > 0) {
    const maxExtend = diag + spacingPx;
    const walk = (origin, tangent, sign, tStart) => {
      const dir = { x: -tangent.y, y: tangent.x };
      let furthest = null;
      for (let k = 1; k * spacingPx <= maxExtend; k++) {
        if (bars.length >= MAX_EXTENDED_BARS) break;
        const d = sign * k * spacingPx;
        const P = { x: origin.x + tangent.x * d, y: origin.y + tangent.y * d };
        const bar = computeBar(P, dir, clipOpts);
        if (!bar) break;
        bars.push({ ...bar, t: tStart + d, extended: true });
        furthest = P;
      }
      if (furthest) extensions.push({ a: origin, b: furthest });
    };
    const first = frame.polyline[0];
    const last = frame.polyline[frame.polyline.length - 1];
    // Start side: from the first tick, backwards along the first segment.
    walk(frame.at(offsets[0]), frame.tangentAt(0), -1, offsets[0]);
    // End side: from the last tick, forwards along the last segment.
    const tEnd = offsets[offsets.length - 1];
    walk(frame.at(tEnd), frame.tangentAt(frame.length), 1, tEnd);
    // Keep the extension strokes anchored on the line ends (not the ticks).
    for (const ext of extensions) {
      const toFirst = Math.hypot(ext.a.x - first.x, ext.a.y - first.y);
      const toLast = Math.hypot(ext.a.x - last.x, ext.a.y - last.y);
      ext.a = toFirst <= toLast ? first : last;
    }
  }

  bars.sort((b1, b2) => b1.t - b2.t);
  let totalLengthPx = 0;
  const indexed = bars.map((bar, index) => {
    totalLengthPx += bar.lengthPx;
    return { ...bar, index, lengthM: bar.lengthPx * meterByPx };
  });

  return {
    ...base,
    spacingM,
    spacingPx,
    bars: indexed,
    extensions,
    barCount: indexed.length,
    totalLengthPx,
    totalLengthM: totalLengthPx * meterByPx,
  };
}
