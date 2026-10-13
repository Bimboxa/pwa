/**
 * Vectorize the black wall bands of a drawn plan into 2-point centre-line
 * segments, at any angle, keeping only the bands whose thickness matches
 * the target (the strokeWidth of the annotation being drawn) — no more, no
 * less.
 *
 * Raster → vector chain after F. Poux ("How to turn a 3D scan into a CAD
 * floor plan"), adapted to an ink drawing (no classified point cloud):
 *
 *   1. binarize (inverse) + exclusion mask of already-annotated zones.
 *   2. wall-evidence grid by THICKNESS FILTER: distance transform → cells at
 *      least minT/2 from the background are the cores of bands thicker than
 *      minT; the band is rebuilt by a dilation clipped to the ink. Regions
 *      thicker than maxT (filled areas, blobs) are removed. Dimension lines,
 *      grid axes, dashed lines, text: all thinner than minT → gone here.
 *   3. close the small holes a crossing line leaves in a band
 *      (morphological closing, padded so border bands survive), drop dust
 *      blobs (connected components under a minimum area).
 *   4. skeletonize each component to its one-cell centre line (Zhang-Suen,
 *      then staircase removal so oblique lines are one cell wide), prune
 *      the short twigs thinning leaves at corners / junctions.
 *   5. walk the skeleton graph into ORDERED chains (ends / junctions).
 *   6. split each chain where it bends (Ramer-Douglas-Peucker on the chain
 *      order) and fit each piece by total least squares.
 *   7. merge the pieces one line explains ("does one line explain both?":
 *      95 % of each piece's cells within a corridor of the shared line, a
 *      tilt guard for long pieces, and a maximum end-to-end gap so a door
 *      opening is never bridged).
 *   8. gates: measured thickness within [minT, maxT], black coverage under
 *      the segment, minimum length.
 *   9. light angle snap onto the ortho axes (≤ 1.5°) — a genuinely oblique
 *      wall stays oblique.
 *  10. join corners: thinning eats ~T/2 at every corner, so L corners are
 *      closed on the intersection of the two lines, and an end sitting on
 *      another wall is extended onto it (T junction).
 *  11. free ends: the ends that were not joined are pushed outward while
 *      the band under them stays filled (thinning also stops ~T/2 short
 *      of a band's end cap).
 *
 * Output: { walls: [{ x1, y1, x2, y2, thickness }], imageSize } in image
 * pixels. `thickness` is the MEASURED band thickness (diagnostic) — the
 * caller draws the segments at the target thickness.
 *
 * Input contract matches detectWallSegmentsAsync (imageUrl, targetThickness
 * in image px, tolerance, minWallLength, exclusion mask) so the runner is
 * shared.
 */
async function detectWallCenterlinesAsync({ msg, payload }) {
  const matList = [];
  const track = (mat) => {
    if (mat) matList.push(mat);
    return mat;
  };

  try {
    const {
      imageUrl,
      targetThickness,
      tolerance = Math.max(2, Math.round((targetThickness || 0) * 0.3)),
      minWallLength = Math.max(20, Math.round((targetThickness || 0) * 4)),
      exclusionMaskBuffer = null,
      maskWidth = 0,
      maskHeight = 0,
      orthoSnapAngleOffsetDeg = 0,
      // Angle snap window onto the ortho axes (degrees).
      angleSnapDeg = 1.5,
      // Coverage gates (same values as detectWallSegmentsAsync, oriented
      // version): overall black density under the drawn segment, per-station
      // band fill, fraction of stations that must individually be filled.
      acceptDensity = 0.7,
      colFillThreshold = 0.6,
      minColPassRatio = 0.85,
    } = payload ?? {};

    if (!imageUrl) throw new Error("imageUrl is required");
    if (!(targetThickness > 0))
      throw new Error("targetThickness must be > 0 (image pixels)");

    const T = targetThickness;
    const minT = Math.max(1, T - tolerance);
    const maxT = T + tolerance;

    // ── 1. Load + inverse binarization (black ink → 255) ────────────────
    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = track(cv.matFromImageData(imageData));
    const width = src.cols;
    const height = src.rows;

    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    const bw = track(new cv.Mat());
    cv.threshold(gray, bw, 128, 255, cv.THRESH_BINARY_INV);

    if (exclusionMaskBuffer && maskWidth === width && maskHeight === height) {
      const mask = new Uint8Array(exclusionMaskBuffer);
      const bwData = bw.data;
      const len = Math.min(mask.length, bwData.length);
      for (let i = 0; i < len; i++) {
        if (mask[i]) bwData[i] = 0;
      }
    }

    // ── 2. Wall-evidence grid: thickness filter ─────────────────────────
    // Distance (L2) of every ink pixel to the background. The centre pixel
    // of a band `t` px thick sits ~ (t + 1) / 2 from the background, so a
    // band thicker than `t` has cells with dist ≥ (t + 1) / 2.
    const dist = track(new cv.Mat());
    cv.distanceTransform(bw, dist, cv.DIST_L2, 3);

    const coreThr = (minT + 1) / 2 - 0.5;
    const core = track(thresholdDistMat(dist, coreThr));
    // Rebuild the bands around their cores: dilate the cores by the half
    // max thickness and clip to the ink.
    const rebuildR = Math.ceil(maxT / 2) + 1;
    const band = track(new cv.Mat());
    cv.dilate(core, band, ellipseKernel(track, rebuildR));
    cv.bitwise_and(band, bw, band);

    // Remove the regions thicker than the gate (filled areas, hatching
    // blobs, title blocks): their cores sit deeper than maxT / 2.
    const thickThr = (maxT + 1) / 2 + 0.5;
    const thick = track(thresholdDistMat(dist, thickThr));
    if (cv.countNonZero(thick) > 0) {
      const thickDil = track(new cv.Mat());
      cv.dilate(thick, thickDil, ellipseKernel(track, Math.ceil(maxT)));
      cv.bitwise_not(thickDil, thickDil);
      cv.bitwise_and(band, thickDil, band);
    }

    // ── 3. Close small holes, drop dust ─────────────────────────────────
    const closeR = Math.max(1, Math.round(T / 4));
    const pad = closeR + 2;
    const padded = track(new cv.Mat());
    cv.copyMakeBorder(
      band,
      padded,
      pad,
      pad,
      pad,
      pad,
      cv.BORDER_CONSTANT,
      new cv.Scalar(0)
    );
    cv.morphologyEx(padded, padded, cv.MORPH_CLOSE, ellipseKernel(track, closeR));
    const closed = track(
      padded.roi(new cv.Rect(pad, pad, width, height)).clone()
    );
    // No clip back to the ink here: the whole point of the closing is to
    // bridge the small white gaps inside a band (text over a wall, a thin
    // white line crossing it). Thin ink never enters `band`, so the closing
    // cannot grow onto a rejected dimension line.

    const labels = track(new cv.Mat());
    const stats = track(new cv.Mat());
    const centroids = track(new cv.Mat());
    const nLabels = cv.connectedComponentsWithStats(
      closed,
      labels,
      stats,
      centroids,
      8,
      cv.CV_32S
    );
    const minArea = 0.5 * minWallLength * minT;
    const labelData = labels.data32S;
    const distData = dist.data32F;
    const bwData = bw.data;

    // ── 4-6. Per component: skeleton → chains → fitted pieces ───────────
    const pruneLen = Math.max(3, Math.round(0.8 * T));
    const rdpTol = Math.max(2, Math.round(0.25 * T));
    const minPieceLen = 1.5 * T;
    let pieces = [];

    for (let label = 1; label < nLabels; label++) {
      const area = stats.intAt(label, cv.CC_STAT_AREA);
      if (area < minArea) continue;
      const bx = stats.intAt(label, cv.CC_STAT_LEFT);
      const by = stats.intAt(label, cv.CC_STAT_TOP);
      const bwid = stats.intAt(label, cv.CC_STAT_WIDTH);
      const bhei = stats.intAt(label, cv.CC_STAT_HEIGHT);

      // Local 0/1 mask with a 1-cell margin.
      const cols = bwid + 2;
      const rows = bhei + 2;
      const m = new Uint8Array(rows * cols);
      for (let r = 0; r < bhei; r++) {
        const rowOff = (by + r) * width;
        for (let c = 0; c < bwid; c++) {
          if (labelData[rowOff + bx + c] === label) m[(r + 1) * cols + c + 1] = 1;
        }
      }

      zhangSuenThin(m, rows, cols);
      removeStaircases(m, rows, cols);
      pruneSpurs(m, rows, cols, pruneLen);
      const { chains } = traceSkeletonChains(m, rows, cols);

      const toImg = (idx) => ({
        x: bx + (idx % cols) - 1,
        y: by + Math.floor(idx / cols) - 1,
      });

      for (const chain of chains) {
        if (chain.length < 3) continue;
        const pts = chain.map(toImg);
        for (const [i, j] of rdpSplit(pts, rdpTol)) {
          const cells = pts.slice(i, j + 1);
          const piece = makePiece(cells);
          if (piece.length >= minPieceLen) pieces.push(piece);
        }
      }
    }

    // ── 7. Merge: does one line explain both pieces? ────────────────────
    pieces = mergeCollinearPieces(pieces, {
      maxGap: 1.5 * T,
      corridor: Math.max(1.5, 0.15 * T),
      maxPerpOffset: maxT,
      longPiece: 4 * T,
      tiltDeg: 2,
    });

    // ── 8. Gates: thickness, coverage, length ───────────────────────────
    const walls = [];
    for (const p of pieces) {
      if (p.length < minWallLength) continue;
      const thickness = medianBandThickness(p.cells, distData, width);
      if (thickness < minT || thickness > maxT) continue;
      const cov = bandCoverage(p, T, bwData, width, height, colFillThreshold);
      if (cov.density < acceptDensity || cov.passRatio < minColPassRatio)
        continue;
      walls.push({ ...p, thickness, coverage: cov.density });
    }

    // ── 9. Light angle snap onto the ortho axes ─────────────────────────
    const offsetRad = ((orthoSnapAngleOffsetDeg || 0) * Math.PI) / 180;
    const snapRad = (angleSnapDeg * Math.PI) / 180;
    for (const w of walls) snapWallAngle(w, offsetRad, snapRad);

    // ── 10. Join corners (L) and T junctions ────────────────────────────
    const joined = joinWalls(walls, { cornerDist: 1.2 * T, teeDist: T });

    // ── 11. Free ends: thinning stops ~T/2 short of a band's end cap ────
    // Extend every end that was not joined while the perpendicular profile
    // of width T under it stays filled (bounded by T).
    extendFreeEnds(walls, joined, T, bwData, width, height, colFillThreshold);

    const out = walls.map((w) => ({
      x1: round1(w.p0.x),
      y1: round1(w.p0.y),
      x2: round1(w.p1.x),
      y2: round1(w.p1.y),
      thickness: round1(w.thickness),
      length: round1(Math.hypot(w.p1.x - w.p0.x, w.p1.y - w.p0.y)),
      coverage: Math.round(w.coverage * 100) / 100,
    }));

    postMessage({
      msg,
      payload: { walls: out, imageSize: { width, height } },
    });
  } catch (err) {
    let error = err;
    if (typeof err === "number" && cv?.exceptionFromPtr) {
      try {
        error = cv.exceptionFromPtr(err).msg;
      } catch {
        error = `OpenCV error ${err}`;
      }
    } else if (err instanceof Error) {
      error = err.message;
    }
    postMessage({ msg, error: String(error) });
  } finally {
    for (const mat of matList) {
      try {
        mat.delete();
      } catch {
        /* already freed */
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function round1(v) {
  return Math.round(v * 10) / 10;
}

function ellipseKernel(track, radius) {
  const size = 2 * Math.max(1, Math.round(radius)) + 1;
  return track(
    cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(size, size))
  );
}

// dist (CV_32F) ≥ thr → CV_8U 255.
function thresholdDistMat(dist, thr) {
  const f = new cv.Mat();
  cv.threshold(dist, f, thr, 255, cv.THRESH_BINARY);
  const u = new cv.Mat();
  f.convertTo(u, cv.CV_8U);
  f.delete();
  return u;
}

// A fitted piece: its skeleton cells, the TLS line, and the extent of the
// cells projected on that line (endpoints are the projections, not the
// noisy end cells).
function makePiece(cells) {
  const line = fitLineTls(cells);
  let t0 = Infinity;
  let t1 = -Infinity;
  for (const c of cells) {
    const t = (c.x - line.cx) * line.ux + (c.y - line.cy) * line.uy;
    if (t < t0) t0 = t;
    if (t > t1) t1 = t;
  }
  return {
    cells,
    line,
    t0,
    t1,
    length: t1 - t0,
    p0: { x: line.cx + t0 * line.ux, y: line.cy + t0 * line.uy },
    p1: { x: line.cx + t1 * line.ux, y: line.cy + t1 * line.uy },
  };
}

function perpDistances(cells, line) {
  return cells.map((c) =>
    Math.abs(-(c.x - line.cx) * line.uy + (c.y - line.cy) * line.ux)
  );
}

function percentile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
  return sorted[idx];
}

function angleBetween(l1, l2) {
  const dot = Math.min(1, Math.abs(l1.ux * l2.ux + l1.uy * l2.uy));
  return Math.acos(dot);
}

/**
 * Greedy merge, longest pieces first, refit after every merge. Two pieces
 * merge when one total-least-squares line through both explains both:
 * the 95th percentile of each piece's perpendicular distance to the shared
 * line is within `corridor`. Guards: the shared line may not tilt by more
 * than `tiltDeg` away from a piece long enough to know its own direction
 * (≥ `longPiece`), and the end-to-end gap along the line stays ≤ `maxGap`
 * (an opening in a wall is never bridged).
 */
function mergeCollinearPieces(pieces, opts) {
  const { maxGap, corridor, maxPerpOffset, longPiece, tiltDeg } = opts;
  const tilt = (tiltDeg * Math.PI) / 180;
  let list = [...pieces].sort((a, b) => b.length - a.length);
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < list.length && !merged; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        // Quick rejects: angle, perpendicular offset, gap along a's line.
        const shorter = Math.min(a.length, b.length);
        const maxAngle = Math.atan2(2, Math.max(1, shorter)) + tilt;
        if (angleBetween(a.line, b.line) > maxAngle) continue;
        const offB =
          Math.abs(
            -(b.line.cx - a.line.cx) * a.line.uy +
              (b.line.cy - a.line.cy) * a.line.ux
          );
        if (offB > maxPerpOffset) continue;
        const tb0 =
          (b.p0.x - a.line.cx) * a.line.ux + (b.p0.y - a.line.cy) * a.line.uy;
        const tb1 =
          (b.p1.x - a.line.cx) * a.line.ux + (b.p1.y - a.line.cy) * a.line.uy;
        const lo = Math.min(tb0, tb1);
        const hi = Math.max(tb0, tb1);
        const gap = Math.max(0, lo - a.t1, a.t0 - hi);
        if (gap > maxGap) continue;

        // The shared line.
        const both = a.cells.concat(b.cells);
        const shared = fitLineTls(both);
        const worst = Math.max(
          percentile(perpDistances(a.cells, shared), 0.95),
          percentile(perpDistances(b.cells, shared), 0.95)
        );
        if (worst > corridor) continue;
        const longer = a.length >= b.length ? a : b;
        if (longer.length >= longPiece && angleBetween(longer.line, shared) > tilt)
          continue;

        const unionPiece = makePiece(both);
        list.splice(j, 1);
        list.splice(i, 1);
        list.push(unionPiece);
        list.sort((x, y) => y.length - x.length);
        merged = true;
        break;
      }
    }
  }
  return list;
}

// Median band thickness under the skeleton cells: 2·dist − 1 (the centre
// pixel of a band `t` thick sits ~ (t + 1) / 2 from the background).
function medianBandThickness(cells, distData, width) {
  const vals = [];
  for (const c of cells) {
    const d = distData[c.y * width + c.x];
    if (d > 0) vals.push(2 * d - 1);
  }
  if (!vals.length) return 0;
  vals.sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)];
}

// Black coverage of the band of width T drawn along the piece: a station
// every pixel along the segment, a perpendicular profile of T samples at
// each station.
function bandCoverage(piece, T, bwData, width, height, colFillThreshold) {
  const { line } = piece;
  const nx = -line.uy;
  const ny = line.ux;
  const half = T / 2;
  const nStations = Math.max(1, Math.round(piece.length));
  const nSamples = Math.max(1, Math.round(T));
  let black = 0;
  let total = 0;
  let pass = 0;
  for (let s = 0; s < nStations; s++) {
    const t = piece.t0 + ((s + 0.5) / nStations) * piece.length;
    const cx = line.cx + t * line.ux;
    const cy = line.cy + t * line.uy;
    let colBlack = 0;
    for (let k = 0; k < nSamples; k++) {
      const d = -half + ((k + 0.5) / nSamples) * T;
      const x = Math.round(cx + d * nx);
      const y = Math.round(cy + d * ny);
      total++;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      if (bwData[y * width + x]) {
        black++;
        colBlack++;
      }
    }
    if (colBlack / nSamples >= colFillThreshold) pass++;
  }
  return { density: total ? black / total : 0, passRatio: pass / nStations };
}

// Turn the wall onto the nearest ortho axis (offset + k·90°) about its
// midpoint when it sits within `snapRad` of it.
function snapWallAngle(w, offsetRad, snapRad) {
  const ang = Math.atan2(w.line.uy, w.line.ux);
  let rel = ang - offsetRad;
  const quarter = Math.PI / 2;
  const k = Math.round(rel / quarter);
  const target = offsetRad + k * quarter;
  let diff = ang - target;
  while (diff > Math.PI / 2) diff -= Math.PI;
  while (diff < -Math.PI / 2) diff += Math.PI;
  if (Math.abs(diff) > snapRad) return;
  const mx = (w.p0.x + w.p1.x) / 2;
  const my = (w.p0.y + w.p1.y) / 2;
  const len = Math.hypot(w.p1.x - w.p0.x, w.p1.y - w.p0.y);
  const ux = Math.cos(target);
  const uy = Math.sin(target);
  w.p0 = { x: mx - (len / 2) * ux, y: my - (len / 2) * uy };
  w.p1 = { x: mx + (len / 2) * ux, y: my + (len / 2) * uy };
  w.line = { ...w.line, cx: mx, cy: my, ux, uy };
}

function lineIntersection(a, b) {
  const d = a.ux * b.uy - a.uy * b.ux;
  if (Math.abs(d) < 1e-6) return null;
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const t = (dx * b.uy - dy * b.ux) / d;
  return { x: a.cx + t * a.ux, y: a.cy + t * a.uy };
}

/**
 * Thinning eats the corners, so the walls stop short of each other.
 *   L corner: two ends within `cornerDist`, both lines crossing within
 *     `cornerDist` of both ends → both ends move onto the crossing.
 *   T junction: an end within `teeDist` of the interior of another wall →
 *     the end is extended onto that wall's line.
 */
function joinWalls(walls, { cornerDist, teeDist }) {
  // Returns the set of "i:p0" / "i:p1" keys of the ends that were joined.
  const ends = (w) => [
    ["p0", w.p0],
    ["p1", w.p1],
  ];
  const moved = new Set();
  const key = (i, k) => `${i}:${k}`;

  // L corners first.
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const X = lineIntersection(walls[i].line, walls[j].line);
      if (!X) continue;
      for (const [ka, pa] of ends(walls[i])) {
        if (moved.has(key(i, ka))) continue;
        for (const [kb, pb] of ends(walls[j])) {
          if (moved.has(key(j, kb))) continue;
          if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > cornerDist) continue;
          if (Math.hypot(pa.x - X.x, pa.y - X.y) > cornerDist) continue;
          if (Math.hypot(pb.x - X.x, pb.y - X.y) > cornerDist) continue;
          walls[i][ka] = { ...X };
          walls[j][kb] = { ...X };
          moved.add(key(i, ka));
          moved.add(key(j, kb));
        }
      }
    }
  }

  // T junctions.
  for (let i = 0; i < walls.length; i++) {
    for (const [ka, pa] of ends(walls[i])) {
      if (moved.has(key(i, ka))) continue;
      let best = null;
      for (let j = 0; j < walls.length; j++) {
        if (j === i) continue;
        const w = walls[j];
        const ux = w.p1.x - w.p0.x;
        const uy = w.p1.y - w.p0.y;
        const len = Math.hypot(ux, uy);
        if (len < 1e-6) continue;
        const t = ((pa.x - w.p0.x) * ux + (pa.y - w.p0.y) * uy) / (len * len);
        // Interior of the other wall (its own ends are L-corner material).
        if (t <= 0.05 || t >= 0.95) continue;
        const foot = { x: w.p0.x + t * ux, y: w.p0.y + t * uy };
        const d = Math.hypot(pa.x - foot.x, pa.y - foot.y);
        if (d > teeDist) continue;
        if (!best || d < best.d) best = { d, foot };
      }
      if (best) {
        walls[i][ka] = best.foot;
        moved.add(key(i, ka));
      }
    }
  }
  return moved;
}

// Per-station band fill under a point of the wall's line (profile of width
// T along the unit normal).
function stationFill(cx, cy, nx, ny, T, bwData, width, height) {
  const nSamples = Math.max(1, Math.round(T));
  const half = T / 2;
  let black = 0;
  for (let k = 0; k < nSamples; k++) {
    const d = -half + ((k + 0.5) / nSamples) * T;
    const x = Math.round(cx + d * nx);
    const y = Math.round(cy + d * ny);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    if (bwData[y * width + x]) black++;
  }
  return black / nSamples;
}

function extendFreeEnds(walls, joined, T, bwData, width, height, fillThr) {
  const maxExt = Math.ceil(T);
  walls.forEach((w, i) => {
    const dx = w.p1.x - w.p0.x;
    const dy = w.p1.y - w.p0.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    for (const [k, dir] of [
      ["p0", -1],
      ["p1", 1],
    ]) {
      if (joined.has(`${i}:${k}`)) continue;
      const p = w[k];
      let ext = 0;
      for (let s = 1; s <= maxExt; s++) {
        const fill = stationFill(
          p.x + dir * s * ux,
          p.y + dir * s * uy,
          nx,
          ny,
          T,
          bwData,
          width,
          height
        );
        if (fill < fillThr) break;
        ext = s;
      }
      if (ext > 0) w[k] = { x: p.x + dir * ext * ux, y: p.y + dir * ext * uy };
    }
  });
}
