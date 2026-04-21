/**
 * Detect wall strips inside the loupe ROI on mouseMove.
 *
 * The loupe is a rectangle of size `loupeBBox.width × loupeBBox.height`
 * centered on the cursor and visually rotated by `orthoAngleRad` (the
 * rotation pivot is the cursor = the AABB centre). The algorithm operates
 * in the loupe's own rotated frame (u along tangent, v along normal), so
 * the scan grid matches the visible rotated rectangle exactly.
 *
 * Pipeline
 * --------
 *  1. Sample lines orthogonal to the detection direction (vertical lines for
 *     "H", horizontal lines for "V"). `sampleCount` is odd so one line passes
 *     through the loupe center.
 *
 *  2. On each sample line, collect raw dark sub-runs and keep only:
 *       (a) a single run whose length ≈ stripWidthPx, OR
 *       (b) a pair of consecutive runs whose combined span ≈ stripWidthPx
 *           AND whose black coverage ≥ 1 - MAX_GAP_RATIO. Such pairs are
 *           merged into one cross-section (handles walls split by a thin
 *           centerline marker / perpendicular trace).
 *     "≈ stripWidthPx" = length ∈ stripWidthPx · [1 - widthTolerance,
 *                                                 1 + widthTolerance].
 *
 *  3. Cluster cross-sections by parallel-line proximity (center v) so each
 *     wall axis is represented by a single seed (the leftmost in tangent
 *     direction).
 *
 *  4. For each seed, scan along the wall axis (tangent) with the shared
 *     `extractSegments` helper to recover all wall spans on that line. A
 *     single line can carry multiple strips separated by openings ≥ 5 px
 *     (doors, gaps). Spans ≤ stripWidthPx + 2 px are dropped (square dots).
 *
 *  5. Each kept span is shifted by -stripWidthPx/2 along the normal so the
 *     output line sits on the wall edge (STRIP centerline convention) and is
 *     emitted with stripOrientation = +1 — the strip body then extends in
 *     +normal direction and covers the dark pixels.
 *
 *     When `pointsOnMedianAxis` is true, step 5 is skipped: no shift is applied
 *     and `stripOrientation` is omitted. The output line then lies on the
 *     **median axis** of the detected dark band — this is used by the
 *     SEGMENT_DETECTION tool to commit plain POLYLINE annotations (symmetric
 *     stroke around the centerline) instead of STRIP annotations.
 *
 * `stripOrientation` is computed by the algorithm and returned per segment;
 * the caller MUST use that value (not the template default) when creating the
 * STRIP annotation, otherwise the body would render off the wall.
 *
 * Output:
 *   Array<{ segments: Array<{
 *     start: {x, y},
 *     end:   {x, y},
 *     stripOrientation?: 1 | -1   // omitted when pointsOnMedianAxis = true
 *   }>}>
 */

import {
  getBrightness,
  extractSegments,
  segLength,
} from "./stripDetectionHelpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAMPLE_COUNT = 21;          // odd → one line crosses the loupe center
const MAX_GAP_RATIO = 0.30;       // merged pair must be ≥ 70% black
const CLUSTER_TOL_RATIO = 0.5;    // line clustering tolerance = stripWidthPx * this
const MIN_WALL_EXTRA_PX = 2;      // wall is "real" if length > stripWidthPx + this
const REFINE_RANGE_RATIO = 0.3;   // search ±ceil(stripWidthPx * this) along normal
const REFINE_RANGE_MAX_PX = 8;    // absolute cap on the refinement search range
const EXTRACT_STEP_PX = 2;
const EXTRACT_MAX_GAP_PX = 5;
const EXTRACT_DENSITY = 0.55;

// ---------------------------------------------------------------------------
// Ortho-aligned tangent / normal
// ---------------------------------------------------------------------------

function getOrthoVectors(orientation, orthoAngleRad) {
  const c = Math.cos(orthoAngleRad);
  const s = Math.sin(orthoAngleRad);
  if (orientation === "V") {
    return {
      tangent: { dx: -s, dy: c },
      normal:  { dx: -c, dy: -s },
    };
  }
  return {
    tangent: { dx: c,  dy: s },
    normal:  { dx: -s, dy: c },
  };
}

// ---------------------------------------------------------------------------
// Pass 1+2: per-line dark-run scan → candidate cross-sections
// ---------------------------------------------------------------------------

function scanSampleLine({
  ax, ay, u,
  halfNormalInt,
  halfNormalScanInt,
  normal,
  imageData, exclusionMask,
  iw, ih,
  darknessThreshold,
  minWidth, maxWidth,
}) {
  // Pass 1 — collect raw dark sub-runs along this line.
  //
  // Scan extends beyond the loupe's normal extent (halfNormalInt) by a
  // margin — up to halfNormalScanInt — so a wall whose centre sits near
  // the loupe edge is always seen in its full width, not truncated to
  // the portion that happens to fit inside the loupe. Pass 2 below still
  // rejects candidates whose centre lies outside the loupe's normal
  // extent, keeping the loupe semantically the ROI.
  const runs = [];
  let runStart = -1;
  let lastDarkV = -1;
  const closeRun = () => {
    if (runStart === -1) return;
    runs.push({ start: runStart, end: lastDarkV });
    runStart = -1;
  };
  for (let v = -halfNormalScanInt; v <= halfNormalScanInt + 1; v++) {
    let isDark = false;
    let outOfBounds = v > halfNormalScanInt;
    if (!outOfBounds) {
      const px = Math.round(ax + v * normal.dx);
      const py = Math.round(ay + v * normal.dy);
      const inside = px >= 0 && px < iw && py >= 0 && py < ih;
      if (inside) {
        const masked = exclusionMask && exclusionMask[py * iw + px];
        if (!masked) isDark = getBrightness(imageData, px, py) < darknessThreshold;
      } else {
        outOfBounds = true;
      }
    }
    if (isDark) {
      if (runStart === -1) runStart = v;
      lastDarkV = v;
    } else {
      closeRun();
    }
    if (outOfBounds) closeRun();
  }
  closeRun();

  // Pass 2 — single run ≈ stripWidthPx OR mergeable pair. Only emit
  // candidates whose centre lies inside the loupe's normal extent so
  // the margin scan above doesn't leak detections for walls outside
  // the visible loupe.
  const out = [];
  const emit = (vStart, vEnd) => {
    const center = (vStart + vEnd) / 2;
    if (Math.abs(center) > halfNormalInt) return;
    out.push({
      u, vStart, vEnd,
      start: { x: ax + vStart * normal.dx, y: ay + vStart * normal.dy },
      end:   { x: ax + vEnd   * normal.dx, y: ay + vEnd   * normal.dy },
    });
  };
  for (let j = 0; j < runs.length; j++) {
    const r1 = runs[j];
    const len1 = r1.end - r1.start + 1;
    if (len1 >= minWidth && len1 <= maxWidth) {
      emit(r1.start, r1.end);
    }
    if (j + 1 < runs.length) {
      const r2 = runs[j + 1];
      const span = r2.end - r1.start + 1;
      if (span >= minWidth && span <= maxWidth) {
        const len2 = r2.end - r2.start + 1;
        const coverage = (len1 + len2) / span;
        if (coverage >= 1 - MAX_GAP_RATIO) emit(r1.start, r2.end);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Step 3: cluster candidates by parallel line, keep the leftmost per cluster
// ---------------------------------------------------------------------------

function clusterByParallelLine(candidates, clusterTol) {
  const enriched = candidates
    .map((c) => ({ ...c, center: (c.vStart + c.vEnd) / 2 }))
    .sort((a, b) => a.center - b.center);

  const clusters = []; // [{ sumCenter, count, best }]
  for (const c of enriched) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(c.center - last.sumCenter / last.count) <= clusterTol) {
      last.sumCenter += c.center;
      last.count += 1;
      if (c.u < last.best.u) last.best = c;
    } else {
      clusters.push({ sumCenter: c.center, count: 1, best: c });
    }
  }
  return clusters.map(({ best }) => best);
}

// ---------------------------------------------------------------------------
// Step 5b: transverse-offset refinement
//
// The detected median-axis segment can sit 1-2 px off the actual wall
// (anti-aliased edges, leftmost-seed bias, stripWidthPx mismatch with the
// true wall width). This helper runs a small ±K-pixel search along the
// normal and keeps the offset that maximises dark-pixel coverage inside a
// stripWidthPx-wide band along the segment, then refines the integer best
// to sub-pixel precision via a parabolic fit over three adjacent scores.
//
// Pure post-processing: does not touch the seed sweep, clustering, or
// extractSegments. Runs on the median axis, so both STRIP (shift to edge
// afterwards) and SEGMENT (no shift) modes benefit from a single hook.
// ---------------------------------------------------------------------------

function refineTransverseOffset(
  seg,
  { normal, stripWidthPx, darknessThreshold, exclusionMask, imageData }
) {
  const iw = imageData.width;
  const ih = imageData.height;
  const halfW = Math.round(stripWidthPx / 2);
  const range = Math.min(
    Math.ceil(stripWidthPx * REFINE_RANGE_RATIO),
    REFINE_RANGE_MAX_PX
  );
  if (range <= 0) return seg;

  const dx = seg.end.x - seg.start.x;
  const dy = seg.end.y - seg.start.y;
  const segLen = Math.sqrt(dx * dx + dy * dy);
  if (segLen <= 0) return seg;
  const steps = Math.max(1, Math.round(segLen));

  const scoreAt = (delta) => {
    const dnx = delta * normal.dx;
    const dny = delta * normal.dy;
    let dark = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const bx = seg.start.x + t * dx + dnx;
      const by = seg.start.y + t * dy + dny;
      for (let w = -halfW; w <= halfW; w++) {
        const px = Math.round(bx + w * normal.dx);
        const py = Math.round(by + w * normal.dy);
        if (px < 0 || py < 0 || px >= iw || py >= ih) continue;
        if (exclusionMask && exclusionMask[py * iw + px]) continue;
        if (getBrightness(imageData, px, py) < darknessThreshold) dark++;
      }
    }
    return dark;
  };

  // Score every integer delta in [-range, +range]. Store in an array so the
  // sub-pixel step below can read the neighbours of the best without
  // re-computing.
  const scores = new Array(2 * range + 1);
  for (let k = -range; k <= range; k++) {
    scores[k + range] = scoreAt(k);
  }

  // Pick the integer best, iterating by increasing |delta| so ties prefer
  // the original detection (delta = 0) and then the smallest shift.
  let bestIdx = range; // delta = 0
  let bestScore = scores[bestIdx];
  for (let k = 1; k <= range; k++) {
    for (const sign of [1, -1]) {
      const idx = range + sign * k;
      if (scores[idx] > bestScore) {
        bestScore = scores[idx];
        bestIdx = idx;
      }
    }
  }

  let finalDelta = bestIdx - range;

  // Parabolic sub-pixel refinement — fit y = a*d² + b*d + c through the
  // three scores at (bestIdx-1, bestIdx, bestIdx+1) and take the vertex.
  // Vertex:  d* = (sPrev - sNext) / (2 * (sPrev - 2*sPeak + sNext)).
  // Since bestIdx is a local max, denom = sPrev - 2*sPeak + sNext ≤ 0, so
  // denom < 0 indicates a true peak we can interpolate. Skip when bestIdx
  // is at the search boundary (no neighbour to sample) or the parabola is
  // flat (denom == 0 → plateau, tiebreaker already chose smallest |delta|).
  if (bestIdx > 0 && bestIdx < scores.length - 1) {
    const sPrev = scores[bestIdx - 1];
    const sPeak = scores[bestIdx];
    const sNext = scores[bestIdx + 1];
    const denom = sPrev - 2 * sPeak + sNext;
    if (denom < 0) {
      const subPx = (0.5 * (sPrev - sNext)) / denom;
      // For a well-formed parabolic peak, subPx ∈ ]-0.5, +0.5[. Clamp to
      // ±1 just as a numerical safety net.
      if (subPx > -1 && subPx < 1) finalDelta += subPx;
    }
  }

  if (finalDelta === 0) return seg;

  const ox = finalDelta * normal.dx;
  const oy = finalDelta * normal.dy;
  return {
    start: { x: seg.start.x + ox, y: seg.start.y + oy },
    end:   { x: seg.end.x   + ox, y: seg.end.y   + oy },
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

/**
 * @param {Object} p
 * @param {ImageData} p.imageData
 * @param {{x,y,width,height}} p.loupeBBox  Loupe ROI in image px
 * @param {number} p.stripWidthPx           Reference strip width (image px)
 * @param {'H'|'V'} [p.orientation='H']
 * @param {number} [p.orthoAngleRad=0]      Ortho snap angle in radians
 * @param {number} [p.darknessThreshold=128]
 * @param {number} [p.widthTolerance=0.30]
 * @param {Uint8Array} [p.exclusionMask]
 * @param {boolean} [p.detectMultiple=true]   When false, keep only the
 *                                            parallel line whose centre v is
 *                                            closest to the loupe centre
 *                                            (still emits multiple strips
 *                                            along that line if separated by
 *                                            openings).
 * @param {boolean} [p.pointsOnMedianAxis=false] When true, skip the edge-shift
 *                                            step and omit stripOrientation
 *                                            from the output: segments lie on
 *                                            the median axis of the detected
 *                                            band. Used by SEGMENT_DETECTION.
 * @returns {Array<{ segments: Array<{start, end, stripOrientation?}> }>}
 */
export default function detectStripFromLoupe({
  imageData,
  loupeBBox,
  stripWidthPx,
  orientation = "H",
  orthoAngleRad = 0,
  darknessThreshold = 128,
  widthTolerance = 0.30,
  exclusionMask,
  detectMultiple = true,
  pointsOnMedianAxis = false,
}) {
  if (!imageData || !loupeBBox || !stripWidthPx) return [];
  if (orientation !== "H" && orientation !== "V") return [];

  const { tangent, normal } = getOrthoVectors(orientation, orthoAngleRad);
  const minWidth = stripWidthPx * (1 - widthTolerance);
  const maxWidth = stripWidthPx * (1 + widthTolerance);

  // Loupe center in image px → origin of the rotated (u, v) frame.
  // The AABB `loupeBBox` is centered on the cursor, and the visible loupe
  // (ScreenCursorV2.jsx) rotates around that same center by the same ortho
  // angle used to build `tangent`/`normal` here — so (cx, cy) is also the
  // centre of the rotated loupe rectangle.
  const cx = loupeBBox.x + loupeBBox.width / 2;
  const cy = loupeBBox.y + loupeBBox.height / 2;

  // Half-extents of the rotated loupe along its OWN axes (tangent, normal).
  // In H orientation tangent is the loupe's width axis and normal its height
  // axis; in V orientation they swap. This is the correct scan-grid size —
  // the previous formula projected the un-rotated AABB onto (tangent, normal)
  // which under-sized the grid at non-zero angles and clipped detection.
  const halfTangent =
    (orientation === "V" ? loupeBBox.height : loupeBBox.width) / 2;
  const halfNormal =
    (orientation === "V" ? loupeBBox.width : loupeBBox.height) / 2;
  const halfNormalInt = Math.ceil(halfNormal);

  // Extend the Pass-1 scan along normal by half the max allowed wall width
  // so a wall whose centre sits anywhere inside the loupe is always seen
  // in its full width (and therefore passes the [minWidth, maxWidth] gate).
  // Pass 2 below still rejects candidates whose centre is outside the loupe,
  // so this margin only helps edge-adjacent walls — it does not leak
  // detections for walls whose axis sits outside the visible loupe.
  const halfNormalScanInt = halfNormalInt + Math.ceil(maxWidth / 2);

  // Enlarged AABB that fully encloses the rotated loupe. Used only as
  // `viewportBBox` for extractSegments below so its tangent scan can reach
  // the ends of the rotated loupe (the seed sweep above doesn't need any
  // AABB clamp because its (u, v) loop is already bounded by the rotated
  // loupe's own half-extents).
  const enclHalfW =
    halfTangent * Math.abs(tangent.dx) + halfNormal * Math.abs(normal.dx);
  const enclHalfH =
    halfTangent * Math.abs(tangent.dy) + halfNormal * Math.abs(normal.dy);
  const enclosingBBox = {
    x: cx - enclHalfW,
    y: cy - enclHalfH,
    width: 2 * enclHalfW,
    height: 2 * enclHalfH,
  };
  const iw = imageData.width;
  const ih = imageData.height;

  // -------------------------------------------------------------------------
  // 1+2. Per sample line, collect candidate cross-sections.
  // -------------------------------------------------------------------------
  const candidates = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const t = i / (SAMPLE_COUNT - 1);
    const u = -halfTangent + t * (2 * halfTangent);
    const ax = cx + u * tangent.dx;
    const ay = cy + u * tangent.dy;
    candidates.push(...scanSampleLine({
      ax, ay, u,
      halfNormalInt,
      halfNormalScanInt,
      normal,
      imageData, exclusionMask,
      iw, ih,
      darknessThreshold,
      minWidth, maxWidth,
    }));
  }
  if (candidates.length === 0) return [];

  // -------------------------------------------------------------------------
  // 3. Cluster by parallel line — one seed per wall axis. When detectMultiple
  //    is false, keep only the line whose centre v is closest to the loupe
  //    centre (v = 0 in the rotated frame).
  // -------------------------------------------------------------------------
  let seeds = clusterByParallelLine(candidates, stripWidthPx * CLUSTER_TOL_RATIO);
  if (!detectMultiple && seeds.length > 1) {
    const closest = seeds.reduce(
      (best, s) => (Math.abs(s.center) < Math.abs(best.center) ? s : best)
    );
    seeds = [closest];
  }

  // -------------------------------------------------------------------------
  // 4+5. Extend each seed along the wall axis with extractSegments, drop
  //      square dots, (optionally) shift to the wall edge, emit with
  //      stripOrientation. When pointsOnMedianAxis is true, skip the shift
  //      and omit stripOrientation so the caller can build a POLYLINE
  //      annotation centered on the detected band.
  // -------------------------------------------------------------------------
  const minWallLength = stripWidthPx + MIN_WALL_EXTRA_PX;
  const stripOrientation = 1;
  const shift = pointsOnMedianAxis ? 0 : -stripOrientation * (stripWidthPx / 2);
  const sx = shift * normal.dx;
  const sy = shift * normal.dy;

  const segments = [];
  for (const seed of seeds) {
    const refPoint = {
      x: (seed.start.x + seed.end.x) / 2,
      y: (seed.start.y + seed.end.y) / 2,
    };
    const wallSegs = extractSegments({
      imageData,
      exclusionMask,
      viewportBBox: enclosingBBox,
      probeDir: normal,
      scanDir: tangent,
      refPoint,
      stripWidthPx,
      stripOrientation: 1, // unused because symmetric: true
      darknessThreshold,
      minWidth,
      maxWidth,
      stepPx: EXTRACT_STEP_PX,
      minSegmentLengthPx: 1,
      maxGapPx: EXTRACT_MAX_GAP_PX,
      symmetric: true,
      densityThreshold: EXTRACT_DENSITY,
    });
    for (const w of wallSegs) {
      // Project the segment onto the loupe's rotated (u, v) frame and clip
      // its tangent extent to the rotated loupe. extractSegments uses the
      // enclosing AABB as its scan clamp, which is wider than the rotated
      // loupe along tangent — without this clip the detected strip can
      // overrun the visible loupe boundary at its ends.
      const uStart =
        (w.start.x - cx) * tangent.dx + (w.start.y - cy) * tangent.dy;
      const uEnd =
        (w.end.x - cx) * tangent.dx + (w.end.y - cy) * tangent.dy;
      // Whole segment outside the loupe on one side → drop.
      if (
        (uStart > halfTangent && uEnd > halfTangent) ||
        (uStart < -halfTangent && uEnd < -halfTangent)
      ) continue;
      const uStartC = Math.max(-halfTangent, Math.min(halfTangent, uStart));
      const uEndC = Math.max(-halfTangent, Math.min(halfTangent, uEnd));
      // extractSegments scans strictly along tangent so v is constant per
      // endpoint in principle, but preserve per-endpoint v for robustness.
      const vStart =
        (w.start.x - cx) * normal.dx + (w.start.y - cy) * normal.dy;
      const vEnd =
        (w.end.x - cx) * normal.dx + (w.end.y - cy) * normal.dy;
      const clipped = {
        start: {
          x: cx + uStartC * tangent.dx + vStart * normal.dx,
          y: cy + uStartC * tangent.dy + vStart * normal.dy,
        },
        end: {
          x: cx + uEndC * tangent.dx + vEnd * normal.dx,
          y: cy + uEndC * tangent.dy + vEnd * normal.dy,
        },
      };
      if (segLength(clipped) <= minWallLength) continue;

      // Refine the median axis transversely to snap onto the darkest band.
      // Absorbs 1-2 px offsets from anti-aliased edges, seed bias, and
      // stripWidthPx vs true wall-width mismatches. No-op when the initial
      // detection is already best.
      const refined = refineTransverseOffset(clipped, {
        normal, stripWidthPx,
        darknessThreshold, exclusionMask, imageData,
      });

      const seg = {
        start: { x: refined.start.x + sx, y: refined.start.y + sy },
        end:   { x: refined.end.x   + sx, y: refined.end.y   + sy },
      };
      if (!pointsOnMedianAxis) seg.stripOrientation = stripOrientation;
      segments.push(seg);
    }
  }

  if (segments.length === 0) return [];
  return [{ segments }];
}
