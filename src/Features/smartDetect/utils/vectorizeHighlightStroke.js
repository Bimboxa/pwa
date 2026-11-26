import simplifyPolylineRdp from "../../geometry/utils/simplifyPolylineRdp.js";

import { otsuClasses } from "./detectRegionBoundary.js";

/**
 * Fit the most likely polyline through the inked pixels lying under a
 * highlighter stroke — « Vectoriser au surligneur » tool.
 *
 * Deterministic, pure (node-testable). Made for sparse rasters (point-cloud
 * sections): the ink is a scatter of dots, not a continuous line, so nothing
 * is skeletonized. The stroke itself gives the ordering of the dots.
 *
 *   1. The stroke axis is cleaned (RDP) and the pixels closer than `radius`
 *      to it are read as "ink" (255 - luminance, composited over white),
 *      averaged by blocks when the stroke is larger than `maxAnalysisSize`.
 *   2. Otsu splits these pixels into paper / ink.
 *   3. Each inked pixel gets (s, d): abscissa along the axis, signed lateral
 *      offset.
 *   4. Slices along s: the weighted median of d over a window of slices
 *      locates the line (stray dots are dropped), the centroid of the
 *      remaining pixels of the slice is the slice point. Empty slices are skipped, so gaps are bridged.
 *   5. RDP on the slice points finds the bends. Each run is refit by total
 *      least squares on its pixels; vertices are the intersections of
 *      consecutive lines; the two ends stop on the outermost inked pixels.
 *   6. Steps 3-5 run a second time along the fitted polyline instead of the
 *      (wobbly) hand stroke, which sharpens the stray-dot rejection.
 *
 * @param {Object} params
 * @param {{width:number,height:number,data:Uint8ClampedArray}} params.imageData
 * @param {Array<{x:number,y:number}>} params.strokePoints Stroke axis,
 *   source-image px.
 * @param {number} params.radius Stroke radius, source-image px.
 * @param {Array<{points:Array<{x:number,y:number}>, radius:number}>}
 *   [params.strokes] Several strokes, each with its own radius, in the order
 *   they were drawn (replaces strokePoints / radius). One shape is fitted
 *   through the pixels of all of them.
 * @param {"FREE"|"LINE"|"RIGHT_ANGLE"|"ARC"} [params.shape="FREE"] What is
 *   fitted through the pixels:
 *   - "FREE": polyline, a vertex at each bend;
 *   - "LINE": one straight segment;
 *   - "RIGHT_ANGLE": polyline whose segments are parallel or perpendicular
 *     to each other (the frame is the dominant direction of the pixels, not
 *     the image axes);
 *   - "ARC": one circular arc — 3 points, the middle one typed "circle"
 *     (square → circle → square convention of the POLYLINE annotations). A
 *     straight run falls back to "LINE".
 * @param {number} [params.maxAnalysisSize=1200] Longest side of the analysed
 *   grid (cells).
 * @param {number} [params.minContrast=20] Smallest gap between the paper and
 *   ink class means (0..255) for ink to exist.
 * @returns {{points:Array<{x,y,type?:"circle"}>, cellSize:number}|{points:null, reason:string}}
 *   `points` in source-image px. Reasons: "INVALID_STROKE", "NO_INK".
 */
export default function vectorizeHighlightStroke({
  imageData,
  strokePoints,
  radius,
  strokes,
  shape = "FREE",
  maxAnalysisSize = 1200,
  minContrast = 20,
} = {}) {
  const strokeList = (strokes ?? [{ points: strokePoints, radius }])
    .map((stroke) => ({
      radius: stroke?.radius,
      points: (stroke?.points ?? []).filter(
        (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
      ),
    }))
    .filter((stroke) => stroke.points.length > 0 && stroke.radius > 0);
  if (!imageData?.data || !strokeList.length) {
    return { points: null, reason: "INVALID_STROKE" };
  }
  const maxRadius = Math.max(...strokeList.map((stroke) => stroke.radius));
  const { width: imgW, height: imgH, data } = imageData;

  // --- 1. analysed window (source px), grid, stroke axis (grid units) ---

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokeList) {
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const side = Math.max(maxX - minX, maxY - minY) + 2 * maxRadius;
  const cellSize = Math.max(1, Math.ceil(side / maxAnalysisSize));
  const x0 = Math.max(0, Math.floor(minX - maxRadius));
  const y0 = Math.max(0, Math.floor(minY - maxRadius));
  const x1 = Math.min(imgW, Math.ceil(maxX + maxRadius));
  const y1 = Math.min(imgH, Math.ceil(maxY + maxRadius));
  const W = Math.floor((x1 - x0) / cellSize);
  const H = Math.floor((y1 - y0) / cellSize);
  if (W < 1 || H < 1) return { points: null, reason: "INVALID_STROKE" };

  // grid coordinates: cell (gx, gy) is centred on (gx, gy)
  // The strokes are chained in the order they were drawn: together they
  // order the pixels, but the jump from one stroke to the next highlights
  // nothing.
  const r = maxRadius / cellSize;
  const axis = [];
  strokeList.forEach((stroke, index) => {
    const strokeRadius = stroke.radius / cellSize;
    axis.push(
      ...simplifyPolylineRdp(
        stroke.points.map((p) => ({
          x: (p.x - x0) / cellSize - 0.5,
          y: (p.y - y0) / cellSize - 0.5,
          stroke: index,
          r: strokeRadius,
        })),
        strokeRadius / 4
      )
    );
  });
  const segments = toSegments(axis);
  const highlighted = segments.filter(({ a, b }) => a.stroke === b.stroke);
  const highlightedLength = highlighted.reduce(
    (sum, segment) => sum + segment.length,
    0
  );
  // a click (or a wiggle smaller than the disc) is not a stroke
  if (!highlighted.length || highlightedLength < Math.min(r, 4)) {
    return { points: null, reason: "INVALID_STROKE" };
  }

  // --- 2. pixels under the stroke ---

  const inStroke = new Uint8Array(W * H);
  for (const { a, ux, uy, length } of highlighted) {
    const r = a.r;
    const bx = a.x + ux * length;
    const by = a.y + uy * length;
    const gx0 = Math.max(0, Math.floor(Math.min(a.x, bx) - r));
    const gx1 = Math.min(W - 1, Math.ceil(Math.max(a.x, bx) + r));
    const gy0 = Math.max(0, Math.floor(Math.min(a.y, by) - r));
    const gy1 = Math.min(H - 1, Math.ceil(Math.max(a.y, by) + r));
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const px = gx - a.x;
        const py = gy - a.y;
        const along = px * ux + py * uy;
        const across = ux * py - uy * px;
        const clamped = Math.max(0, Math.min(length, along));
        if (Math.hypot(along - clamped, across) <= r) inStroke[gy * W + gx] = 1;
      }
    }
  }

  // --- 3. ink of these pixels, paper / ink split ---

  const ink = new Float32Array(W * H);
  const histogram = new Float64Array(256);
  let count = 0;
  for (let gy = 0; gy < H; gy++) {
    for (let gx = 0; gx < W; gx++) {
      const cell = gy * W + gx;
      if (!inStroke[cell]) continue;
      let sum = 0;
      for (let dy = 0; dy < cellSize; dy++) {
        let i = ((y0 + gy * cellSize + dy) * imgW + x0 + gx * cellSize) * 4;
        for (let dx = 0; dx < cellSize; dx++, i += 4) {
          const lum =
            0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          sum += ((255 - lum) * data[i + 3]) / 255;
        }
      }
      ink[cell] = sum / (cellSize * cellSize);
      histogram[Math.max(0, Math.min(255, Math.round(ink[cell])))] += 1;
      count += 1;
    }
  }
  if (count < 4) return { points: null, reason: "INVALID_STROKE" };
  const classes = otsuClasses(histogram, count);
  if (!classes || classes.highMean - classes.lowMean < minContrast) {
    return { points: null, reason: "NO_INK" };
  }
  const level = (classes.lowMean + classes.highMean) / 2;
  const inked = [];
  for (let cell = 0; cell < W * H; cell++) {
    if (inStroke[cell] && ink[cell] >= level) inked.push(cell);
  }
  if (!inked.length) return { points: null, reason: "NO_INK" };

  // --- 4. + 5. fit along the stroke, then along the fit itself ---

  // The second pass measures the offsets from the first fit instead of the
  // (wobbly) hand stroke: the line pixels gather around 0, so the stray
  // ones stand out and the bends are located on clean data.
  const grid = {
    W,
    ink,
    sliceWidth: Math.max(2, r / 2),
    tolerance: Math.max(1.5, 0.2 * r),
    reach: r,
    shape,
  };
  let fit = fitAlongAxis(inked, segments, grid);
  if (fit) fit = fitAlongAxis(inked, toSegments(fit.axis), grid) ?? fit;
  if (!fit) return { points: null, reason: "NO_INK" };

  const points = [];
  for (const vertex of fit.vertices) {
    const point = {
      ...vertex,
      x: x0 + (vertex.x + 0.5) * cellSize,
      y: y0 + (vertex.y + 0.5) * cellSize,
    };
    const previous = points[points.length - 1];
    if (
      previous &&
      Math.hypot(point.x - previous.x, point.y - previous.y) < 1e-6
    ) {
      continue;
    }
    points.push(point);
  }
  // a single blob of ink is not a line
  if (points.length < 2) return { points: null, reason: "NO_INK" };

  return { points, cellSize };
}

// Polyline (grid units) → segments { a, ux, uy, length, start }.
function toSegments(polyline) {
  const segments = [];
  let start = 0;
  for (let i = 0; i + 1 < polyline.length; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!(length > 1e-6)) continue;
    segments.push({
      a,
      b,
      ux: (b.x - a.x) / length,
      uy: (b.y - a.y) / length,
      length,
      start,
    });
    start += length;
  }
  return segments;
}

// Shape (grid units) through the inked `cells`, ordered along the axis
// `segments`: { vertices, axis } — `axis` is the polyline that follows the
// shape (the vertices themselves, or the sampled arc). Null when the cells
// do not make a line.
function fitAlongAxis(
  cells,
  segments,
  { W, ink, sliceWidth, tolerance, reach, shape }
) {
  if (!segments.length) return null;

  // (s, d) of each cell: abscissa along the axis, signed lateral offset
  const sOf = new Map();
  const dOf = new Map();
  let sMin = Infinity;
  let sMax = -Infinity;
  for (const cell of cells) {
    const gx = cell % W;
    const gy = (cell - gx) / W;
    let best = Infinity;
    segments.forEach(({ a, ux, uy, length, start }, index) => {
      const px = gx - a.x;
      const py = gy - a.y;
      const along = px * ux + py * uy;
      const across = ux * py - uy * px;
      const clamped = Math.max(0, Math.min(length, along));
      const distance = Math.hypot(along - clamped, across);
      if (distance >= best) return;
      best = distance;
      // beyond the two ends of the axis: keep the true abscissa / offset so
      // these pixels extend the line instead of piling up on the end
      const isBeyond =
        (index === 0 && along < 0) ||
        (index === segments.length - 1 && along > length);
      sOf.set(cell, start + (isBeyond ? along : clamped));
      dOf.set(cell, isBeyond ? across : Math.sign(across) * distance);
    });
    sMin = Math.min(sMin, sOf.get(cell));
    sMax = Math.max(sMax, sOf.get(cell));
  }

  // slices along the axis
  const sliceCount = Math.floor((sMax - sMin) / sliceWidth) + 1;
  const sliceCells = Array.from({ length: sliceCount }, () => []);
  for (const cell of cells) {
    sliceCells[Math.floor((sOf.get(cell) - sMin) / sliceWidth)].push(cell);
  }

  // The line is located by the weighted median offset of a window of
  // slices (a single slice may hold one stray dot only); the pixels of the
  // slice away from it are dropped. Slice point = centroid of the others.
  const HALF_WINDOW = 2;
  const slices = []; // { x, y, cells } — ordered along the axis
  for (let index = 0; index < sliceCount; index++) {
    if (!sliceCells[index].length) continue;
    const windowCells = [];
    for (
      let i = Math.max(0, index - HALF_WINDOW);
      i <= Math.min(sliceCount - 1, index + HALF_WINDOW);
      i++
    ) {
      windowCells.push(...sliceCells[i]);
    }
    const median = weightedMedian(windowCells, dOf, ink);
    const deviations = windowCells.map((cell) =>
      Math.abs(dOf.get(cell) - median)
    );
    deviations.sort((u, v) => u - v);
    const mad = deviations[deviations.length >> 1];
    const band = Math.min(reach, Math.max(1.5, 2.5 * 1.4826 * mad));
    const kept = sliceCells[index].filter(
      (cell) => Math.abs(dOf.get(cell) - median) <= band
    );
    if (!kept.length) continue;
    let weight = 0;
    let x = 0;
    let y = 0;
    for (const cell of kept) {
      const gx = cell % W;
      weight += ink[cell];
      x += ink[cell] * gx;
      y += (ink[cell] * (cell - gx)) / W;
    }
    slices.push({ x: x / weight, y: y / weight, cells: kept });
  }
  if (!slices.length) return null;

  if (shape === "ARC") {
    const arc = fitArc(slices, ink, W);
    if (arc) return arc;
  }

  // bends (none for a single segment), line fit per run
  const isSingleSegment = shape === "LINE" || shape === "ARC";
  const bendIndexes = isSingleSegment
    ? [0, slices.length - 1]
    : simplifyPolylineRdp(slices, tolerance).map((bend) =>
        slices.indexOf(bend)
      );
  if (bendIndexes.length < 2) bendIndexes.push(bendIndexes[0]);
  let runs = []; // { line, cells, bend } — bend: slice point ending the run
  for (let k = 0; k + 1 < bendIndexes.length; k++) {
    const from = bendIndexes[k];
    const to = bendIndexes[k + 1];
    const runCells = [];
    for (let i = from; i <= to; i++) runCells.push(...slices[i].cells);
    const forward = {
      x: slices[to].x - slices[from].x,
      y: slices[to].y - slices[from].y,
    };
    runs.push({
      line: fitLine(runCells, ink, W, forward),
      cells: runCells,
      bend: slices[to],
      length: Math.hypot(forward.x, forward.y),
    });
  }
  if (shape === "RIGHT_ANGLE") runs = squareRuns(runs, ink, W);

  // vertices: outermost inked pixels at the two ends, line crossings between
  const first = runs[0].line;
  const last = runs[runs.length - 1].line;
  let startT = Infinity;
  for (const cell of slices[0].cells) {
    startT = Math.min(startT, abscissaOnLine(first, cell, W));
  }
  let endT = -Infinity;
  for (const cell of slices[slices.length - 1].cells) {
    endT = Math.max(endT, abscissaOnLine(last, cell, W));
  }
  const vertices = [pointOnLine(first, startT)];
  for (let k = 0; k + 1 < runs.length; k++) {
    const { bend } = runs[k];
    const crossing = intersectLines(runs[k].line, runs[k + 1].line);
    const isNearBend =
      crossing &&
      (shape === "RIGHT_ANGLE" ||
        Math.hypot(crossing.x - bend.x, crossing.y - bend.y) <=
          Math.max(2 * tolerance, reach));
    vertices.push(isNearBend ? crossing : { x: bend.x, y: bend.y });
  }
  vertices.push(pointOnLine(last, endT));
  return { vertices, axis: vertices };
}

// "RIGHT_ANGLE": the runs are made parallel or perpendicular to their
// dominant direction (length-weighted mean of the directions modulo 90°),
// each line going through the centroid of its pixels; consecutive runs
// left with the same direction are merged.
function squareRuns(runs, ink, W) {
  let cos4 = 0;
  let sin4 = 0;
  for (const { line, length } of runs) {
    const angle = Math.atan2(line.uy, line.ux);
    cos4 += Math.max(length, 1e-6) * Math.cos(4 * angle);
    sin4 += Math.max(length, 1e-6) * Math.sin(4 * angle);
  }
  const frameAngle = Math.atan2(sin4, cos4) / 4;

  const squared = [];
  for (const run of runs) {
    // quarter turn of the frame closest to the direction of the run
    const turns = Math.round(
      (Math.atan2(run.line.uy, run.line.ux) - frameAngle) / (Math.PI / 2)
    );
    const previous = squared[squared.length - 1];
    if (previous && (previous.turns - turns) % 2 === 0) {
      previous.cells.push(...run.cells);
      previous.bend = run.bend;
      continue;
    }
    squared.push({ turns, cells: [...run.cells], bend: run.bend });
  }
  return squared.map(({ turns, cells, bend }) => {
    const angle = frameAngle + (turns * Math.PI) / 2;
    const forward = { x: Math.cos(angle), y: Math.sin(angle) };
    const { cx, cy } = fitLine(cells, ink, W, forward);
    return { line: { cx, cy, ux: forward.x, uy: forward.y }, cells, bend };
  });
}

// "ARC": least-squares circle through the pixels of the slices (weighted by
// ink) → { vertices: [start, middle typed "circle", end], axis: the arc,
// sampled }. Null when the pixels are (nearly) aligned.
function fitArc(slices, ink, W) {
  if (slices.length < 3) return null;
  const cells = [];
  for (const slice of slices) cells.push(...slice.cells);

  let weight = 0;
  let mx = 0;
  let my = 0;
  for (const cell of cells) {
    const gx = cell % W;
    weight += ink[cell];
    mx += ink[cell] * gx;
    my += (ink[cell] * (cell - gx)) / W;
  }
  mx /= weight;
  my /= weight;
  let suu = 0;
  let suv = 0;
  let svv = 0;
  let suuu = 0;
  let svvv = 0;
  let suvv = 0;
  let svuu = 0;
  for (const cell of cells) {
    const gx = cell % W;
    const u = gx - mx;
    const v = (cell - gx) / W - my;
    const w = ink[cell];
    suu += w * u * u;
    suv += w * u * v;
    svv += w * v * v;
    suuu += w * u * u * u;
    svvv += w * v * v * v;
    suvv += w * u * v * v;
    svuu += w * v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-9 * (suu + svv) ** 2) return null;
  const uc = (0.5 * ((suuu + suvv) * svv - (svvv + svuu) * suv)) / det;
  const vc = (0.5 * ((svvv + svuu) * suu - (suuu + suvv) * suv)) / det;
  const radius = Math.sqrt(uc * uc + vc * vc + (suu + svv) / weight);
  const centre = { x: mx + uc, y: my + vc };

  // angles measured from the middle slice, in (-π, π]
  const middle = slices[slices.length >> 1];
  const middleAngle = Math.atan2(middle.y - centre.y, middle.x - centre.x);
  const relativeAngle = (x, y) => {
    const angle = Math.atan2(y - centre.y, x - centre.x) - middleAngle;
    return angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI));
  };
  const firstSlice = slices[0];
  const lastSlice = slices[slices.length - 1];
  const sense =
    relativeAngle(lastSlice.x, lastSlice.y) >=
    relativeAngle(firstSlice.x, firstSlice.y)
      ? 1
      : -1;
  // the two ends stop on the outermost inked pixels
  let startAngle = Infinity;
  for (const cell of firstSlice.cells) {
    const gx = cell % W;
    startAngle = Math.min(
      startAngle,
      sense * relativeAngle(gx, (cell - gx) / W)
    );
  }
  let endAngle = -Infinity;
  for (const cell of lastSlice.cells) {
    const gx = cell % W;
    endAngle = Math.max(endAngle, sense * relativeAngle(gx, (cell - gx) / W));
  }
  const sweep = endAngle - startAngle;
  if (!(sweep > 1e-6)) return null;
  // sagitta below half a pixel: a straight segment, not an arc
  if (radius * (1 - Math.cos(sweep / 2)) < 0.5) return null;

  const pointAt = (angle) => ({
    x: centre.x + radius * Math.cos(middleAngle + sense * angle),
    y: centre.y + radius * Math.sin(middleAngle + sense * angle),
  });
  const SAMPLES = 24;
  const axis = [];
  for (let i = 0; i <= SAMPLES; i++) {
    axis.push(pointAt(startAngle + (sweep * i) / SAMPLES));
  }
  return {
    vertices: [
      pointAt(startAngle),
      { ...pointAt(startAngle + sweep / 2), type: "circle" },
      pointAt(endAngle),
    ],
    axis,
  };
}

// Median of values.get(cell) over `cells`, each weighted by weights[cell].
function weightedMedian(cells, values, weights) {
  const sorted = [...cells].sort((u, v) => values.get(u) - values.get(v));
  let total = 0;
  for (const cell of sorted) total += weights[cell];
  let sum = 0;
  for (const cell of sorted) {
    sum += weights[cell];
    if (sum >= total / 2) return values.get(cell);
  }
  return values.get(sorted[sorted.length - 1]);
}

// Total-least-squares line through the cells (weighted by ink): centroid +
// unit direction, oriented like `forward`. A degenerate cloud (single
// pixel) takes the direction of `forward`.
function fitLine(cells, ink, W, forward) {
  let weight = 0;
  let cx = 0;
  let cy = 0;
  for (const cell of cells) {
    const gx = cell % W;
    weight += ink[cell];
    cx += ink[cell] * gx;
    cy += (ink[cell] * (cell - gx)) / W;
  }
  cx /= weight;
  cy /= weight;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const cell of cells) {
    const gx = cell % W;
    const dx = gx - cx;
    const dy = (cell - gx) / W - cy;
    sxx += ink[cell] * dx * dx;
    sxy += ink[cell] * dx * dy;
    syy += ink[cell] * dy * dy;
  }
  const forwardLength = Math.hypot(forward.x, forward.y);
  let ux;
  let uy;
  if (
    sxx + syy < 1e-9 ||
    (Math.abs(sxy) < 1e-12 && Math.abs(sxx - syy) < 1e-12)
  ) {
    if (!(forwardLength > 0)) return { cx, cy, ux: 1, uy: 0 };
    ux = forward.x / forwardLength;
    uy = forward.y / forwardLength;
  } else {
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    ux = Math.cos(angle);
    uy = Math.sin(angle);
  }
  if (ux * forward.x + uy * forward.y < 0) {
    ux = -ux;
    uy = -uy;
  }
  return { cx, cy, ux, uy };
}

function abscissaOnLine(line, cell, W) {
  const gx = cell % W;
  return (gx - line.cx) * line.ux + ((cell - gx) / W - line.cy) * line.uy;
}

function pointOnLine(line, t) {
  return { x: line.cx + t * line.ux, y: line.cy + t * line.uy };
}

// Crossing of two lines; null when they are (nearly) parallel.
function intersectLines(a, b) {
  const det = a.ux * b.uy - a.uy * b.ux;
  if (Math.abs(det) < 0.05) return null;
  const t = ((b.cx - a.cx) * b.uy - (b.cy - a.cy) * b.ux) / det;
  return pointOnLine(a, t);
}
