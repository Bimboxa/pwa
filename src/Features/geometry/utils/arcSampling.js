// Shared arc-sampling helpers for POLYLINE / POLYGON annotations.
// Points can have type: "circle" or "square" (default).
// A square → circle → square (S-C-S) pattern represents a circular arc
// passing through the three points.

export function typeOf(p) {
  return p?.type === "circle" ? "circle" : "square";
}

export function circleFromThreePoints(p0, p1, p2) {
  const x1 = p0.x;
  const y1 = p0.y;
  const x2 = p1.x;
  const y2 = p1.y;
  const x3 = p2.x;
  const y3 = p2.y;

  const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(d) < 1e-9) return null;

  const x1sq_y1sq = x1 * x1 + y1 * y1;
  const x2sq_y2sq = x2 * x2 + y2 * y2;
  const x3sq_y3sq = x3 * x3 + y3 * y3;

  const ux =
    (x1sq_y1sq * (y2 - y3) + x2sq_y2sq * (y3 - y1) + x3sq_y3sq * (y1 - y2)) / d;
  const uy =
    (x1sq_y1sq * (x3 - x2) + x2sq_y2sq * (x1 - x3) + x3sq_y3sq * (x2 - x1)) / d;

  const center = { x: ux, y: uy };
  const r = Math.hypot(x1 - ux, y1 - uy);
  return { center, r };
}

// Circles of every S-C-S arc in a (closed) typed ring. Fed to
// collapseArcsInPolyline as source hints so an untouched curve is recovered
// robustly (concentric-source match) rather than via the generic curvature
// heuristic only. Shared by applyOpeningOnPolygon and mergeTwoPolygons.
export function extractArcCircles(ring) {
  const circles = [];
  const n = ring?.length ?? 0;
  if (n < 3) return circles;
  const at = (i) => ring[((i % n) + n) % n];
  for (let i = 0; i < n; i++) {
    const p0 = at(i);
    const p1 = at(i + 1);
    const p2 = at(i + 2);
    if (
      typeOf(p0) !== "circle" &&
      typeOf(p1) === "circle" &&
      typeOf(p2) !== "circle"
    ) {
      const c = circleFromThreePoints(p0, p1, p2);
      if (c && Number.isFinite(c.r) && c.r > 0) circles.push(c);
    }
  }
  return circles;
}

// Flatten collapseArcsInPolyline units into one typed ring (squares for
// straight runs, square-circle-square for arcs). Consecutive units share a
// boundary vertex, so the first point of every unit after the first is dropped.
// Shared by applyOpeningOnPolygon and mergeTwoPolygons.
export function arcUnitsToTypedPoints(units) {
  const out = [];
  units.forEach((u, ui) => {
    (u.points || []).forEach((p, pi) => {
      if (ui > 0 && pi === 0) return;
      out.push({
        x: p.x,
        y: p.y,
        type: p.type === "circle" ? "circle" : "square",
      });
    });
  });
  return out;
}

function angleFromCenter(center, point) {
  return Math.atan2(point.y - center.y, point.x - center.x);
}

export function sampleArcPoints(
  startPx,
  endPx,
  center,
  radius,
  isCW,
  samples = 10
) {
  const angleStart = angleFromCenter(center, startPx);
  const angleEnd = angleFromCenter(center, endPx);

  const TWO_PI = Math.PI * 2;

  let diff = angleEnd - angleStart;

  if (isCW) {
    while (diff < 0) diff += TWO_PI;
    while (diff >= TWO_PI) diff -= TWO_PI;
  } else {
    while (diff > 0) diff -= TWO_PI;
    while (diff <= -TWO_PI) diff += TWO_PI;
  }

  const absDiff = Math.abs(diff);
  const useLargeArc = absDiff > Math.PI;

  let angleSpan;
  if (useLargeArc) {
    angleSpan = TWO_PI - absDiff;
  } else {
    angleSpan = absDiff;
  }

  const arcPoints = [];
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    let angle;
    if (isCW) {
      angle = angleStart + t * (useLargeArc ? TWO_PI - angleSpan : angleSpan);
    } else {
      angle = angleStart - t * (useLargeArc ? TWO_PI - angleSpan : angleSpan);
    }
    while (angle < 0) angle += TWO_PI;
    while (angle >= TWO_PI) angle -= TWO_PI;

    arcPoints.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }

  return arcPoints;
}

/**
 * Same as `expandArcsInPath`, but also translates an `hiddenSegmentsIdx`
 * list from the original-segment indexing to the expanded-segment indexing.
 * For an S-C-S triplet, the original segment from `P0→P1` (the first half
 * of the arc) maps to the first `samples` expanded segments, and `P1→P2`
 * (the second half) maps to the next `samples`. Non-arc segments pass
 * through 1:1.
 *
 * Returns `{ points, hiddenSegmentsIdx }` ready to feed to a downstream
 * sweep / extrusion routine that knows how to skip hidden expanded segments.
 */
// Translate an `hiddenSegmentsIdx` list from the original-segment indexing to
// the expanded-segment indexing produced by `expandArcsInPath` /
// `expandRingWithOffsets` (both emit the SAME geometry / segment count, so the
// translation is shared). For an S-C-S triplet, segment `P0→P1` maps to the
// first `samples` expanded segments and `P1→P2` to the next `samples`; non-arc
// segments pass through 1:1.
function translateHiddenSegments(path, samples, hiddenSegmentsIdx, closeLine) {
  const hidden = new Set(hiddenSegmentsIdx ?? []);
  if (hidden.size === 0) return [];

  const n = path.length;
  const get = closeLine ? (k) => path[((k % n) + n) % n] : (k) => path[k];
  const range = new Array(closeLine ? n : Math.max(0, n - 1)).fill(null);
  let outSegIdx = 0;
  let i = 0;
  let consumed = 0;
  while (consumed < n) {
    const p0 = get(i);
    const p1 = get(i + 1);
    const p2 = get(i + 2);
    const isArc =
      p1 &&
      p2 &&
      typeOf(p0) !== "circle" &&
      typeOf(p1) === "circle" &&
      typeOf(p2) !== "circle";

    if (isArc) {
      const circ = circleFromThreePoints(p0, p1, p2);
      if (circ && Number.isFinite(circ.r) && circ.r > 0) {
        const idx0 = ((i % n) + n) % n;
        const idx1 = (((i + 1) % n) + n) % n;
        range[idx0] = [outSegIdx, outSegIdx + samples - 1];
        range[idx1] = [outSegIdx + samples, outSegIdx + 2 * samples - 1];
        outSegIdx += 2 * samples;
        i += 2;
        consumed += 2;
        continue;
      }
    }
    const idx = ((i % n) + n) % n;
    if (closeLine || i < n - 1) {
      range[idx] = [outSegIdx, outSegIdx];
      outSegIdx += 1;
    }
    i += 1;
    consumed += 1;
  }

  const newHidden = [];
  for (const origSeg of hidden) {
    const r = range[origSeg];
    if (!r) continue;
    for (let s = r[0]; s <= r[1]; s++) newHidden.push(s);
  }
  return newHidden;
}

export function expandArcsInPathWithHiddenMap(
  path,
  samples = 6,
  hiddenSegmentsIdx = [],
  closeLine = false
) {
  return {
    points: expandArcsInPath(path, samples, closeLine),
    hiddenSegmentsIdx: translateHiddenSegments(
      path,
      samples,
      hiddenSegmentsIdx,
      closeLine
    ),
  };
}

/**
 * Same as `expandArcsInPathWithHiddenMap`, but carries per-vertex
 * `offsetTop` / `offsetBottom` onto the sampled arc points (linearly
 * interpolated along the arc — see `expandRingWithOffsets`). Use this wherever
 * a per-vertex-offset (ramp / slope) wall is sampled into segments so that
 * moving one arc endpoint's offset ramps smoothly across the whole arc, instead
 * of only affecting the single sub-segment adjacent to the anchor.
 */
export function expandRingWithOffsetsAndHiddenMap(
  path,
  samples = 6,
  hiddenSegmentsIdx = [],
  closeLine = false
) {
  return {
    points: expandRingWithOffsets(path, samples, closeLine),
    hiddenSegmentsIdx: translateHiddenSegments(
      path,
      samples,
      hiddenSegmentsIdx,
      closeLine
    ),
  };
}

/**
 * Expand each square → circle → square (S-C-S) arc in `path` into `samples`
 * straight segments along the underlying circle. Non-arc points pass through
 * unchanged.
 *
 * Anchor points (the original non-circle vertices at the arc boundaries, and
 * any point not part of an S-C-S triplet) are preserved with all their
 * properties (e.g. `_id`, `type`) so downstream algorithms that rely on those
 * fields (e.g. topology-anchor matching in smartDetect) keep working. Sampled
 * intermediate points are plain `{x, y}` objects — no synthetic `_id`.
 *
 * Degenerate (collinear) arcs fall back to straight segments. Consecutive
 * circle-type points (C-C chains) are treated as straight segments, matching
 * the convention used in getPointsSurface.
 */
export function expandArcsInPath(path, samples = 6, closeLine = false) {
  const n = path.length;
  if (n < 3) return path.map((p) => ({ ...p }));

  const get = closeLine ? (k) => path[((k % n) + n) % n] : (k) => path[k];
  const out = [];
  let i = 0;
  let consumed = 0;
  while (consumed < n) {
    const p0 = get(i);
    const p1 = get(i + 1);
    const p2 = get(i + 2);

    const isArc =
      p1 &&
      p2 &&
      typeOf(p0) !== "circle" &&
      typeOf(p1) === "circle" &&
      typeOf(p2) !== "circle";

    if (isArc) {
      const circ = circleFromThreePoints(p0, p1, p2);
      if (circ && Number.isFinite(circ.r) && circ.r > 0) {
        const cross =
          (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
        const isCW = cross > 0;

        // Push p0 with all its properties, then sampled points up to (but
        // excluding) p2. p2 will be picked up as p0 of the next iteration,
        // preserving its properties too.
        out.push({ ...p0 });
        const arc01 = sampleArcPoints(
          p0,
          p1,
          circ.center,
          circ.r,
          isCW,
          samples
        );
        for (const s of arc01) out.push({ x: s.x, y: s.y });
        const arc12 = sampleArcPoints(
          p1,
          p2,
          circ.center,
          circ.r,
          isCW,
          samples
        );
        for (let k = 0; k < arc12.length - 1; k++) {
          out.push({ x: arc12[k].x, y: arc12[k].y });
        }
        i += 2;
        consumed += 2;
        continue;
      }
      // Degenerate: straight segments
      out.push({ ...p0 });
      i += 1;
      consumed += 1;
      continue;
    }

    out.push({ ...p0 });
    i += 1;
    consumed += 1;
  }

  return out;
}

/**
 * Like `expandArcsInPath`, but the number of samples per arc half adapts to the
 * arc size so each emitted chord stays close to `targetChordPx` (and never far
 * below it). Use this when the sampled segments feed a planar arrangement whose
 * node-merge tolerance would DROP sub-segments shorter than the tolerance —
 * fixed dense sampling of a small arc produces sub-tolerance chords that get
 * collapsed, breaking the loop (see detectPolygonFromAnnotations). Sampling by
 * the straight chord under-samples curvy arcs, which is the safe direction here
 * (longer chords, never shorter). Only topology matters downstream; the final
 * geometry is recovered to true arcs elsewhere, so coarser sampling is fine.
 */
export function expandArcsInPathAdaptive(
  path,
  targetChordPx = 12,
  closeLine = false
) {
  const n = path.length;
  if (n < 3) return path.map((p) => ({ ...p }));

  const target = Math.max(1, targetChordPx);
  const MAX_SAMPLES = 24;
  const get = closeLine ? (k) => path[((k % n) + n) % n] : (k) => path[k];
  const out = [];
  let i = 0;
  let consumed = 0;
  while (consumed < n) {
    const p0 = get(i);
    const p1 = get(i + 1);
    const p2 = get(i + 2);

    const isArc =
      p1 &&
      p2 &&
      typeOf(p0) !== "circle" &&
      typeOf(p1) === "circle" &&
      typeOf(p2) !== "circle";

    if (isArc) {
      const circ = circleFromThreePoints(p0, p1, p2);
      if (circ && Number.isFinite(circ.r) && circ.r > 0) {
        const cross =
          (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
        const isCW = cross > 0;
        const s01 = Math.min(
          MAX_SAMPLES,
          Math.max(1, Math.ceil(Math.hypot(p1.x - p0.x, p1.y - p0.y) / target))
        );
        const s12 = Math.min(
          MAX_SAMPLES,
          Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / target))
        );
        out.push({ ...p0 });
        const arc01 = sampleArcPoints(p0, p1, circ.center, circ.r, isCW, s01);
        for (const s of arc01) out.push({ x: s.x, y: s.y });
        const arc12 = sampleArcPoints(p1, p2, circ.center, circ.r, isCW, s12);
        for (let k = 0; k < arc12.length - 1; k++) {
          out.push({ x: arc12[k].x, y: arc12[k].y });
        }
        i += 2;
        consumed += 2;
        continue;
      }
      out.push({ ...p0 });
      i += 1;
      consumed += 1;
      continue;
    }

    out.push({ ...p0 });
    i += 1;
    consumed += 1;
  }

  return out;
}

const lerp = (a, b, t) => a + (b - a) * t;

// Directional sweep angle (radians, absolute) of the arc from `from` to `to`
// around `center` — same normalization as sampleArcPoints.
function arcSweepAngle(center, from, to, isCW) {
  const a0 = angleFromCenter(center, from);
  const a1 = angleFromCenter(center, to);
  const TWO_PI = Math.PI * 2;
  let diff = a1 - a0;
  if (isCW) {
    while (diff < 0) diff += TWO_PI;
    while (diff >= TWO_PI) diff -= TWO_PI;
  } else {
    while (diff > 0) diff -= TWO_PI;
    while (diff <= -TWO_PI) diff += TWO_PI;
  }
  return Math.abs(diff);
}

// Angle-adaptive per-half-arc sample count for the per-vertex-Z mesh paths
// (extrudeClosedShape + getAnnotationQties developed surface — MUST stay
// shared so the rendered mesh and the computed quantities agree): a full
// circle reads as ~SEGMENTS_PER_FULL_CIRCLE segments, while short fillet
// arcs keep a handful of samples instead of a fixed dense count (fixed 24
// per half-arc made every arc annotation ~4× heavier on each rebuild).
export const SEGMENTS_PER_FULL_CIRCLE = 24;
export function adaptiveArcSamples(spanRad) {
  return Math.max(
    2,
    Math.min(
      12,
      Math.ceil((spanRad * SEGMENTS_PER_FULL_CIRCLE) / (2 * Math.PI))
    )
  );
}

/**
 * Same geometry as `expandArcsInPath`, but also carries per-vertex
 * `offsetTop` / `offsetBottom` onto the sampled arc points by linearly
 * interpolating them along the arc (anchor points keep their own offsets).
 *
 * Used wherever a sloped/ramped contour must be triangulated directly (the
 * 3D per-vertex-Z mesh and the developed-surface quantity), so a curved
 * corner follows the ramp instead of collapsing onto the chord polygon of
 * its control points. Single-sourced so the rendered mesh and the computed
 * developed surface stay in sync.
 *
 * `samples` is a per-HALF-arc count: either a number, or a function
 * (spanRadians) => count for angle-adaptive sampling (adaptiveArcSamples).
 */
export function expandRingWithOffsets(ring, samples = 6, closeLine = false) {
  const n = (ring || []).length;
  if (n < 3) return (ring || []).map((p) => ({ ...p }));
  const get = closeLine ? (k) => ring[((k % n) + n) % n] : (k) => ring[k];
  const resolveSamples = (center, from, to, isCW) =>
    typeof samples === "function"
      ? samples(arcSweepAngle(center, from, to, isCW))
      : samples;
  const out = [];
  let i = 0;
  let consumed = 0;
  while (consumed < n) {
    const p0 = get(i);
    const p1 = get(i + 1);
    const p2 = get(i + 2);
    const isArc =
      p1 &&
      p2 &&
      typeOf(p0) !== "circle" &&
      typeOf(p1) === "circle" &&
      typeOf(p2) !== "circle";
    if (isArc) {
      const circ = circleFromThreePoints(p0, p1, p2);
      if (circ && Number.isFinite(circ.r) && circ.r > 0) {
        const cross =
          (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
        const isCW = cross > 0;
        const t0 = p0.offsetTop ?? 0;
        const b0 = p0.offsetBottom ?? 0;
        const t1 = p1.offsetTop ?? 0;
        const b1 = p1.offsetBottom ?? 0;
        const t2 = p2.offsetTop ?? 0;
        const b2 = p2.offsetBottom ?? 0;
        const s01 = resolveSamples(circ.center, p0, p1, isCW);
        const s12 = resolveSamples(circ.center, p1, p2, isCW);
        out.push({ ...p0 });
        const arc01 = sampleArcPoints(p0, p1, circ.center, circ.r, isCW, s01);
        arc01.forEach((s, k) => {
          const f = (k + 1) / s01;
          out.push({
            x: s.x,
            y: s.y,
            offsetTop: lerp(t0, t1, f),
            offsetBottom: lerp(b0, b1, f),
          });
        });
        const arc12 = sampleArcPoints(p1, p2, circ.center, circ.r, isCW, s12);
        for (let k = 0; k < arc12.length - 1; k++) {
          const f = (k + 1) / s12;
          out.push({
            x: arc12[k].x,
            y: arc12[k].y,
            offsetTop: lerp(t1, t2, f),
            offsetBottom: lerp(b1, b2, f),
          });
        }
        i += 2;
        consumed += 2;
        continue;
      }
    }
    out.push({ ...p0 });
    i += 1;
    consumed += 1;
  }
  return out;
}
