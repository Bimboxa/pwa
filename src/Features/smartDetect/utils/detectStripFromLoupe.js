/**
 * Detect axis-aligned wall strips inside the loupe ROI on mouseMove.
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
 * `stripOrientation` is computed by the algorithm and returned per segment;
 * the caller MUST use that value (not the template default) when creating the
 * STRIP annotation, otherwise the body would render off the wall.
 *
 * Output:
 *   Array<{ segments: Array<{
 *     start: {x, y},
 *     end:   {x, y},
 *     stripOrientation: 1 | -1
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
  normal,
  imageData, exclusionMask,
  iw, ih,
  xMin, yMin, xMax, yMax,
  darknessThreshold,
  minWidth, maxWidth,
}) {
  // Pass 1 — collect raw dark sub-runs along this line.
  const runs = [];
  let runStart = -1;
  let lastDarkV = -1;
  const closeRun = () => {
    if (runStart === -1) return;
    runs.push({ start: runStart, end: lastDarkV });
    runStart = -1;
  };
  for (let v = -halfNormalInt; v <= halfNormalInt + 1; v++) {
    let isDark = false;
    let outOfBounds = v > halfNormalInt;
    if (!outOfBounds) {
      const px = Math.round(ax + v * normal.dx);
      const py = Math.round(ay + v * normal.dy);
      const inside =
        px >= xMin && px < xMax && py >= yMin && py < yMax &&
        px >= 0 && px < iw && py >= 0 && py < ih;
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

  // Pass 2 — single run ≈ stripWidthPx OR mergeable pair.
  const out = [];
  const emit = (vStart, vEnd) => {
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
 * @returns {Array<{ segments: Array<{start, end, stripOrientation}> }>}
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
}) {
  if (!imageData || !loupeBBox || !stripWidthPx) return [];
  if (orientation !== "H" && orientation !== "V") return [];

  const { tangent, normal } = getOrthoVectors(orientation, orthoAngleRad);
  const minWidth = stripWidthPx * (1 - widthTolerance);
  const maxWidth = stripWidthPx * (1 + widthTolerance);

  // Loupe center in image px → origin of the rotated (u, v) frame.
  const cx = loupeBBox.x + loupeBBox.width / 2;
  const cy = loupeBBox.y + loupeBBox.height / 2;

  // Project the loupe rectangle onto the rotated axes — exact useful range.
  const halfTangent =
    (loupeBBox.width / 2) * Math.abs(tangent.dx) +
    (loupeBBox.height / 2) * Math.abs(tangent.dy);
  const halfNormal =
    (loupeBBox.width / 2) * Math.abs(normal.dx) +
    (loupeBBox.height / 2) * Math.abs(normal.dy);
  const halfNormalInt = Math.ceil(halfNormal);

  const xMin = loupeBBox.x;
  const yMin = loupeBBox.y;
  const xMax = loupeBBox.x + loupeBBox.width;
  const yMax = loupeBBox.y + loupeBBox.height;
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
      normal,
      imageData, exclusionMask,
      iw, ih,
      xMin, yMin, xMax, yMax,
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
  //      square dots, shift to the wall edge, emit with stripOrientation.
  // -------------------------------------------------------------------------
  const minWallLength = stripWidthPx + MIN_WALL_EXTRA_PX;
  const stripOrientation = 1;
  const shift = -stripOrientation * (stripWidthPx / 2);
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
      viewportBBox: loupeBBox,
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
      if (segLength(w) <= minWallLength) continue;
      segments.push({
        start: { x: w.start.x + sx, y: w.start.y + sy },
        end:   { x: w.end.x   + sx, y: w.end.y   + sy },
        stripOrientation,
      });
    }
  }

  if (segments.length === 0) return [];
  return [{ segments }];
}
