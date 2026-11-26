import {
  pruneSpurs,
  removeStaircases,
  traceSkeletonChains,
  zhangSuenThin,
} from "../../geometry/utils/skeletonGrid.js";

// Vectorization of the footprint a point cloud leaves on a section plane:
// from the 2D points of the slice (the cloud points within a few millimetres
// of the plane, projected on it), the most probable strokes as polylines.
//
// Pure and isolated: no three.js, no DOM, no base map — plain numbers in,
// plain numbers out, in the unit of the input (metres).
//
// A scan samples SURFACES only: in a thin slice, a wall is a thin ribbon of
// points (two ribbons, one per face, when both faces were scanned), never a
// filled band. The method therefore follows the density ridges:
//
//   1. density grid   — points counted per cell;
//   2. denoising      — cells under an adaptive count threshold are dropped;
//   3. closing        — dilate / erode, bridges the sampling gaps of a ribbon;
//   4. small blobs    — connected components too small to carry a stroke go;
//   5. skeleton       — Zhang-Suen thinning + spur pruning: 1-cell wide lines;
//   6. chains         — skeleton paths between ends / junctions;
//   7. split + refit  — each chain is cut at its corners (RDP), each piece is
//                       re-fitted by total least squares on the ORIGINAL
//                       points around it (sub-cell accuracy), the vertices
//                       are the intersections of consecutive fitted lines
//                       (rounded-corner artefacts and collinear vertices
//                       are dropped);
//   8. scoring        — coverage of each polyline by real points, weighted
//                       by the fit residual; short / weak strokes are dropped;
//   9. junctions      — polyline ends meeting at one skeleton junction are
//                       welded on a common point.
//
// Nothing is straightened or snapped to an axis: the output follows the
// points. Curves come out as chords within `simplifyTolM` of the skeleton.
//
// Input
//   points        Float32Array | number[]  [x0, y0, x1, y1, …]
//   cellSize      grid cell (default 0.01 = 1 cm)
//   closeRadius   closing radius in cells (default 2: bridges gaps ≤ 4 cells)
//   densityRatio  cell threshold = max(1, densityRatio × median cell count)
//   simplifyTolM  corner detection tolerance (default 1.5 × cellSize)
//   minLengthM    shortest stroke kept (default 0.1)
//   minScore      weakest stroke kept, 0..1 (default 0.5)
//   maxCells      grid size cap; the cell grows beyond it (default 16 M)
//
// Output
//   polylines: [{ points: [{x, y, joint?}], closed, length, score, coverage,
//                 rms }], strongest first. `joint` (integer) is shared by the
//                 ends welded together: the same point for the caller.
//   stats: { pointCount, cellSize, cols, rows, threshold, chainCount }

const DEFAULTS = {
  cellSize: 0.01,
  closeRadius: 2,
  densityRatio: 0.2,
  minLengthM: 0.1,
  minScore: 0.5,
  maxCells: 16_000_000,
};

// Consecutive fitted lines closer than this to parallel have no usable
// intersection.
const MIN_INTERSECTION_SIN = Math.sin((5 * Math.PI) / 180);
// Cells ignored at both ends of a piece when gathering its points: near a
// corner, the points of the other leg would bend the fit.
const END_TRIM_CELLS = 2;

export default function vectorizeSliceFootprint(options = {}) {
  const { points, closeRadius, densityRatio, minLengthM, minScore, maxCells } =
    { ...DEFAULTS, ...options };
  let cellSize = options.cellSize > 0 ? options.cellSize : DEFAULTS.cellSize;

  const pointCount = Math.floor((points?.length ?? 0) / 2);
  const empty = (extra = {}) => ({
    polylines: [],
    stats: { pointCount, cellSize, cols: 0, rows: 0, chainCount: 0, ...extra },
  });
  if (pointCount < 2) return empty();

  // 1. density grid

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < pointCount; i++) {
    const x = points[i * 2],
      y = points[i * 2 + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX + minY + maxX + maxY)) return empty();

  // margin: room for the closing, and the 1-cell empty border the skeleton
  // helpers expect
  const margin = closeRadius + 2;
  const sizeFor = (cell) => ({
    cols: Math.floor((maxX - minX) / cell) + 1 + 2 * margin,
    rows: Math.floor((maxY - minY) / cell) + 1 + 2 * margin,
  });
  let { cols, rows } = sizeFor(cellSize);
  if (cols * rows > maxCells) {
    cellSize *= Math.sqrt((cols * rows) / maxCells) * 1.01;
    ({ cols, rows } = sizeFor(cellSize));
  }
  const size = cols * rows;
  const simplifyTolM =
    options.simplifyTolM > 0 ? options.simplifyTolM : 1.5 * cellSize;

  const cellOf = new Uint32Array(pointCount);
  const counts = new Uint32Array(size);
  for (let i = 0; i < pointCount; i++) {
    const c = Math.floor((points[i * 2] - minX) / cellSize) + margin;
    const r = Math.floor((points[i * 2 + 1] - minY) / cellSize) + margin;
    const cell = r * cols + c;
    cellOf[i] = cell;
    counts[cell]++;
  }
  // points of each cell: order[start[cell] .. start[cell + 1])
  const start = new Uint32Array(size + 1);
  for (let i = 0; i < size; i++) start[i + 1] = start[i] + counts[i];
  const order = new Uint32Array(pointCount);
  const cursor = start.slice(0, size);
  for (let i = 0; i < pointCount; i++) order[cursor[cellOf[i]]++] = i;

  const cellX = (cell) => minX + ((cell % cols) - margin + 0.5) * cellSize;
  const cellY = (cell) =>
    minY + (Math.floor(cell / cols) - margin + 0.5) * cellSize;

  // 2. denoising

  const occupied = [];
  for (let i = 0; i < size; i++) if (counts[i]) occupied.push(counts[i]);
  occupied.sort((a, b) => a - b);
  const median = occupied[Math.floor(occupied.length / 2)] ?? 0;
  const threshold = Math.max(1, Math.floor(densityRatio * median));
  const raw = new Uint8Array(size);
  for (let i = 0; i < size; i++) if (counts[i] >= threshold) raw[i] = 1;

  // 3. closing

  let mask = raw.slice();
  for (let k = 0; k < closeRadius; k++) mask = morph(mask, rows, cols, true);
  for (let k = 0; k < closeRadius; k++) mask = morph(mask, rows, cols, false);

  // 4. small blobs

  const minBlobCells = Math.max(3, Math.floor((0.5 * minLengthM) / cellSize));
  removeSmallComponents(mask, rows, cols, minBlobCells);

  // 5. skeleton

  zhangSuenThin(mask, rows, cols);
  // 2-cell wide diagonal steps are spurious junctions: they would chop the
  // chains into fragments
  removeStaircases(mask, rows, cols);
  pruneSpurs(mask, rows, cols, closeRadius + 2);
  removeStaircases(mask, rows, cols);

  // 6. chains

  const { chains } = traceSkeletonChains(mask, rows, cols);
  const stats = {
    pointCount,
    cellSize,
    cols,
    rows,
    threshold,
    chainCount: chains.length,
  };
  if (!chains.length) return { polylines: [], stats };

  // 7. split + refit

  // a piece of at most this many cells is "short" (see buildPolyline)
  const shortPieceCells = 2 * closeRadius + 4;
  const stamp = new Uint32Array(size);
  let stampId = 0;
  const gathered = [];

  // Total least squares line through the original points around the chain
  // cells [from, to], refined once on the points close to the first fit.
  function fitPiece(chain, from, to) {
    const trim = to - from >= 2 * END_TRIM_CELLS + 3 ? END_TRIM_CELLS : 0;
    stampId++;
    gathered.length = 0;
    for (let k = from + trim; k <= to - trim; k++) {
      const cell = chain[k];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const near = cell + dr * cols + dc;
          if (stamp[near] === stampId) continue;
          stamp[near] = stampId;
          for (let o = start[near]; o < start[near + 1]; o++)
            gathered.push(order[o]);
        }
      }
    }
    let line = fitLine(points, gathered, null, 0);
    if (line) line = fitLine(points, gathered, line, 1.5 * cellSize) ?? line;
    if (line) return line;
    // no point around (a piece made of bridged gaps only): the chord
    const ax = cellX(chain[from]),
      ay = cellY(chain[from]);
    const dx = cellX(chain[to]) - ax,
      dy = cellY(chain[to]) - ay;
    const length = Math.hypot(dx, dy) || 1;
    return { cx: ax, cy: ay, ux: dx / length, uy: dy / length, rms: 0, n: 0 };
  }

  // chain: cell indices → { points, closed, rms, firstCell, lastCell }
  function buildPolyline(chain) {
    const cells = chain.map((cell) => ({ x: cellX(cell), y: cellY(cell) }));
    const isLoop = chain.length > 3 && chain[0] === chain[chain.length - 1];
    const pieces = rdpSplit(cells, simplifyTolM).map(([from, to]) => ({
      from,
      to,
      line: fitPiece(chain, from, to),
    }));

    // Corner between two pieces: the intersection of their lines, looked
    // for around the cells between them.
    const cornerOf = (a, b) => {
      const at = cells[Math.round((a.to + b.from) / 2)];
      const reach = 4 * simplifyTolM + (b.from - a.to) * cellSize;
      return intersectLines(a.line, b.line, at, reach);
    };

    // The closing rounds the inside of a sharp corner: the skeleton cuts it
    // with a short oblique piece. Such a piece, between two long ones whose
    // lines meet right there, is dropped — the corner is their intersection.
    const isLong = (piece) => piece.to - piece.from > shortPieceCells;
    for (let k = pieces.length - 2; k >= 1; k--) {
      const previous = pieces[k - 1],
        piece = pieces[k],
        next = pieces[k + 1];
      if (isLong(piece) || !isLong(previous) || !isLong(next)) continue;
      if (cornerOf(previous, next)) pieces.splice(k, 1);
    }

    const lines = pieces.map((piece) => piece.line);
    const closed = isLoop && pieces.length >= 3;
    const corner = (a, b) => {
      const at = cells[Math.round((a.to + b.from) / 2)];
      return (
        cornerOf(a, b) ?? midpoint(project(a.line, at), project(b.line, at))
      );
    };

    const vertices = [];
    if (closed) {
      // the loop closes on its seed cell: last piece → first piece
      const last = pieces[pieces.length - 1];
      vertices.push(
        intersectLines(last.line, pieces[0].line, cells[0], 4 * simplifyTolM) ??
          midpoint(
            project(last.line, cells[0]),
            project(pieces[0].line, cells[0])
          )
      );
    } else {
      vertices.push(project(lines[0], cells[0]));
    }
    for (let k = 1; k < pieces.length; k++) {
      vertices.push(corner(pieces[k - 1], pieces[k]));
    }
    if (!closed) {
      vertices.push(project(lines[lines.length - 1], cells[cells.length - 1]));
    }

    // Two pieces of one straight stroke (the skeleton bends near a corner):
    // their common vertex lies on the chord of its neighbours — dropped.
    for (let k = vertices.length - 2; k >= 1; k--) {
      const offset = distanceToChord(
        vertices[k],
        vertices[k - 1],
        vertices[k + 1]
      );
      if (offset < cellSize / 2) vertices.splice(k, 1);
    }

    let weight = 0,
      sum2 = 0;
    lines.forEach((line) => {
      weight += line.n;
      sum2 += line.rms * line.rms * line.n;
    });
    return {
      points: vertices,
      closed,
      rms: weight ? Math.sqrt(sum2 / weight) : 0,
      firstCell: chain[0],
      lastCell: chain[chain.length - 1],
      firstLine: lines[0],
      lastLine: lines[lines.length - 1],
    };
  }

  // 8. scoring

  // Share of the polyline length lying on (or next to) cells that really
  // hold points — the closing may have invented the rest.
  function getCoverage(polyline) {
    const step = cellSize / 2;
    let total = 0,
      covered = 0;
    forEachSegment(polyline, (a, b) => {
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(1, Math.ceil(length / step));
      for (let k = 0; k <= n; k++) {
        const x = a.x + ((b.x - a.x) * k) / n;
        const y = a.y + ((b.y - a.y) * k) / n;
        const c = Math.floor((x - minX) / cellSize) + margin;
        const r = Math.floor((y - minY) / cellSize) + margin;
        total++;
        if (c < 1 || r < 1 || c >= cols - 1 || r >= rows - 1) continue;
        let hit = false;
        for (let dr = -1; dr <= 1 && !hit; dr++)
          for (let dc = -1; dc <= 1 && !hit; dc++)
            if (raw[(r + dr) * cols + c + dc]) hit = true;
        if (hit) covered++;
      }
    });
    return total ? covered / total : 0;
  }

  const candidates = chains.map(buildPolyline).map((polyline) => {
    let length = 0;
    forEachSegment(polyline, (a, b) => {
      length += Math.hypot(b.x - a.x, b.y - a.y);
    });
    const coverage = getCoverage(polyline);
    // a clean ribbon has a residual well under a cell; 3 cells = noise
    const residualPenalty = 0.5 * Math.min(1, polyline.rms / (3 * cellSize));
    return {
      ...polyline,
      length,
      coverage,
      score: coverage * (1 - residualPenalty),
    };
  });

  // 9. junctions

  // Junction clusters: the chains too short to be strokes are the inside of
  // a thick junction — their two end cells are one junction.
  const junctionChainLength = closeRadius + 3;
  const parent = new Map();
  const find = (cell) => {
    let root = cell;
    while (parent.has(root) && parent.get(root) !== root)
      root = parent.get(root);
    parent.set(cell, root);
    return root;
  };
  const union = (a, b) => {
    const ra = find(a),
      rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  chains.forEach((chain) => {
    const a = chain[0],
      b = chain[chain.length - 1];
    find(a);
    find(b);
    if (chain.length <= junctionChainLength) union(a, b);
  });

  const kept = candidates.filter(
    (polyline) => polyline.length >= minLengthM && polyline.score >= minScore
  );

  // ends of the kept open polylines, per junction cluster
  const endsByCluster = new Map();
  kept.forEach((polyline) => {
    if (polyline.closed) return;
    [
      { cell: polyline.firstCell, index: 0, line: polyline.firstLine },
      {
        cell: polyline.lastCell,
        index: polyline.points.length - 1,
        line: polyline.lastLine,
      },
    ].forEach((end) => {
      const cluster = find(end.cell);
      if (!endsByCluster.has(cluster)) endsByCluster.set(cluster, []);
      endsByCluster.get(cluster).push({ polyline, ...end });
    });
  });
  let joint = 0;
  const maxWeldM = (closeRadius + 3) * cellSize;
  endsByCluster.forEach((ends) => {
    if (ends.length < 2) return;
    const current = ends.map((end) => end.polyline.points[end.index]);
    const centre = {
      x: current.reduce((sum, p) => sum + p.x, 0) / current.length,
      y: current.reduce((sum, p) => sum + p.y, 0) / current.length,
    };
    // point closest to every end line, when it stays at the junction
    const solved = closestPointToLines(ends.map((end) => end.line));
    const common =
      solved && Math.hypot(solved.x - centre.x, solved.y - centre.y) <= maxWeldM
        ? solved
        : centre;
    // an end too far from the common point is another junction: left alone
    const welded = ends.filter((end, i) => {
      const p = current[i];
      return Math.hypot(p.x - common.x, p.y - common.y) <= 2 * maxWeldM;
    });
    if (welded.length < 2) return;
    const id = joint++;
    welded.forEach((end) => {
      end.polyline.points[end.index] = { x: common.x, y: common.y, joint: id };
    });
  });

  const polylines = kept
    .sort((a, b) => b.score * b.length - a.score * a.length)
    .map(({ points: vertices, closed, length, score, coverage, rms }) => ({
      points: vertices,
      closed,
      length,
      score,
      coverage,
      rms,
    }));
  return { polylines, stats };
}

///////////   HELPERS   ///////////

// One 8-neighbourhood dilation (grow = true) or erosion step. The border
// cells stay 0.
function morph(mask, rows, cols, grow) {
  const out = new Uint8Array(mask.length);
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c;
      let any = 0,
        all = 1;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (mask[i + dr * cols + dc]) any = 1;
          else all = 0;
        }
      }
      out[i] = grow ? any : all;
    }
  }
  return out;
}

// Clears the 8-connected components of fewer than `minCells` cells.
function removeSmallComponents(mask, rows, cols, minCells) {
  const seen = new Uint8Array(mask.length);
  const stack = [];
  const component = [];
  for (let seed = 0; seed < mask.length; seed++) {
    if (!mask[seed] || seen[seed]) continue;
    component.length = 0;
    stack.push(seed);
    seen[seed] = 1;
    while (stack.length) {
      const i = stack.pop();
      component.push(i);
      const r = Math.floor(i / cols),
        c = i % cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr,
            cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          const j = rr * cols + cc;
          if (!mask[j] || seen[j]) continue;
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (component.length < minCells) component.forEach((i) => (mask[i] = 0));
  }
}

// Total least squares line through the points `indices` of the flat
// `points` array: the line minimising the PERPENDICULAR residuals (closed
// form: major eigenvector of the centred covariance). With `near` (a first
// fit), only the points within `maxDistance` of it are used.
// → { cx, cy, ux, uy, rms, n } or null (fewer than 2 points, or no spread).
function fitLine(points, indices, near, maxDistance) {
  let n = 0,
    sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0,
    sxy = 0;
  for (let k = 0; k < indices.length; k++) {
    const x = points[indices[k] * 2],
      y = points[indices[k] * 2 + 1];
    if (near) {
      const d = -(x - near.cx) * near.uy + (y - near.cy) * near.ux;
      if (Math.abs(d) > maxDistance) continue;
    }
    n++;
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  if (n < 2) return null;
  const cx = sx / n,
    cy = sy / n;
  const vxx = sxx / n - cx * cx,
    vyy = syy / n - cy * cy,
    vxy = sxy / n - cx * cy;
  if (vxx + vyy < 1e-12) return null;
  const theta = 0.5 * Math.atan2(2 * vxy, vxx - vyy);
  const ux = Math.cos(theta),
    uy = Math.sin(theta);
  // variance across the line = the small eigenvalue
  const across = Math.max(0, vxx * uy * uy - 2 * vxy * ux * uy + vyy * ux * ux);
  return { cx, cy, ux, uy, rms: Math.sqrt(across), n };
}

function project(line, p) {
  const t = (p.x - line.cx) * line.ux + (p.y - line.cy) * line.uy;
  return { x: line.cx + t * line.ux, y: line.cy + t * line.uy };
}

// Distance from p to the segment a-b.
function distanceToChord(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t =
    length2 > 0
      ? Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2)
        )
      : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Intersection of two fitted lines, or null when they are close to parallel
// or meet further than `maxDistance` from `near` (the corner cell).
function intersectLines(a, b, near, maxDistance) {
  const cross = a.ux * b.uy - a.uy * b.ux;
  if (Math.abs(cross) < MIN_INTERSECTION_SIN) return null;
  const t = ((b.cx - a.cx) * b.uy - (b.cy - a.cy) * b.ux) / cross;
  const p = { x: a.cx + t * a.ux, y: a.cy + t * a.uy };
  if (Math.hypot(p.x - near.x, p.y - near.y) > maxDistance) return null;
  return p;
}

// Least squares point closest to every line (sum of squared perpendicular
// distances), or null when the lines are close to parallel.
function closestPointToLines(lines) {
  let a11 = 0,
    a12 = 0,
    a22 = 0,
    b1 = 0,
    b2 = 0;
  lines.forEach(({ cx, cy, ux, uy }) => {
    // I − u·uᵀ
    const m11 = 1 - ux * ux,
      m12 = -ux * uy,
      m22 = 1 - uy * uy;
    a11 += m11;
    a12 += m12;
    a22 += m22;
    b1 += m11 * cx + m12 * cy;
    b2 += m12 * cx + m22 * cy;
  });
  const det = a11 * a22 - a12 * a12;
  if (Math.abs(det) < 1e-3 * lines.length) return null;
  return {
    x: (b1 * a22 - b2 * a12) / det,
    y: (a11 * b2 - a12 * b1) / det,
  };
}

function forEachSegment({ points, closed }, callback) {
  for (let i = 0; i + 1 < points.length; i++)
    callback(points[i], points[i + 1]);
  if (closed && points.length > 2)
    callback(points[points.length - 1], points[0]);
}

// Ramer-Douglas-Peucker split of an ordered chain of {x, y}: only decides
// WHERE to cut (the pieces are then fitted on the original points).
// → inclusive index ranges [i, j], in order.
function rdpSplit(points, tolerance) {
  const out = [];
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    if (j - i < 2) {
      out.push([i, j]);
      continue;
    }
    const a = points[i],
      b = points[j];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    let split = -1,
      best = -1;
    for (let m = i + 1; m < j; m++) {
      const p = points[m];
      const d =
        length < 1e-9
          ? Math.hypot(p.x - a.x, p.y - a.y)
          : Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)) / length;
      if (d > best) {
        best = d;
        split = m;
      }
    }
    if (split < 0 || best <= tolerance) {
      out.push([i, j]);
      continue;
    }
    // right first, so the left range pops first (output stays ordered)
    stack.push([split, j]);
    stack.push([i, split]);
  }
  return out;
}
