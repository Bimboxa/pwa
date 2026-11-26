/**
 * Detect the frontier between the blank (white / transparent) part and the
 * inked part of a raster base map inside the zone highlighted by the user —
 * « Détection de frontière auto » tool. The zone is the union of the
 * highlighter strokes (a polyline swept by a disc each).
 *
 * Deterministic, pure (no import, node-testable). Works on noisy rasters
 * (point-cloud scans): the frontier is the iso-line of the BLURRED ink
 * density, not a pixel edge.
 *
 *   1. The bounding box of the zone (plus a margin for the blur) is read
 *      as an "ink" field (255 - luminance, composited over white), averaged
 *      by blocks when the box is larger than `maxAnalysisSize`.
 *   2. The field is blurred (two box passes) to absorb the speckle.
 *   3. The values inside the zone are split in two classes (Otsu). The
 *      frontier level is halfway between the class means: the 50 % crossing
 *      of a blurred step sits on the original step.
 *   4. Marching squares trace the iso-line at that level (sub-pixel), in the
 *      cells that lie entirely inside the zone. The chains are open where
 *      they leave the zone.
 *   5. The longest chain is returned, densely sampled.
 *
 * @param {Object} params
 * @param {{width:number,height:number,data:Uint8ClampedArray}} params.imageData
 * @param {Array<{points:Array<{x:number,y:number}>, radius:number}>}
 *   params.strokes Highlighter strokes (axis and half-width), source-image
 *   px.
 * @param {number} [params.maxAnalysisSize=1200] Longest side of the analysed
 *   grid (cells).
 * @param {number} [params.blurRadius=3] Box radius, in grid cells.
 * @param {number} [params.minContrast=20] Smallest gap between the two class
 *   means (0..255) for a frontier to exist.
 * @param {number} [params.minLengthCells=10] Shortest chain kept.
 * @returns {{points:Array<{x,y}>, closed:boolean, cellSize:number,
 *   blurRadiusPx:number}|{points:null, reason:string}}
 *   `points` in source-image px. Reasons: "INVALID_REGION", "NO_BOUNDARY".
 */
export default function detectRegionBoundary({
  imageData,
  strokes,
  maxAnalysisSize = 1200,
  blurRadius = 3,
  minContrast = 20,
  minLengthCells = 10,
} = {}) {
  const zone = (strokes ?? [])
    .map((stroke) => ({
      radius: stroke?.radius,
      points: (stroke?.points ?? []).filter(
        (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
      ),
    }))
    .filter(({ points, radius }) => points.length > 0 && radius > 0);
  if (!imageData?.data || zone.length === 0) {
    return { points: null, reason: "INVALID_REGION" };
  }
  const { width: imgW, height: imgH, data } = imageData;

  // --- 1. analysed window (source px) and grid ---

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { points, radius } of zone) {
    for (const p of points) {
      if (p.x - radius < minX) minX = p.x - radius;
      if (p.y - radius < minY) minY = p.y - radius;
      if (p.x + radius > maxX) maxX = p.x + radius;
      if (p.y + radius > maxY) maxY = p.y + radius;
    }
  }
  const regionSide = Math.max(maxX - minX, maxY - minY);
  if (!(regionSide > 0)) return { points: null, reason: "INVALID_REGION" };

  const cellSize = Math.max(1, Math.ceil(regionSide / maxAnalysisSize));
  const margin = (2 * blurRadius + 1) * cellSize;
  const x0 = Math.max(0, Math.floor(minX - margin));
  const y0 = Math.max(0, Math.floor(minY - margin));
  const x1 = Math.min(imgW, Math.ceil(maxX + margin));
  const y1 = Math.min(imgH, Math.ceil(maxY + margin));
  const W = Math.floor((x1 - x0) / cellSize);
  const H = Math.floor((y1 - y0) / cellSize);
  if (W < 2 || H < 2) return { points: null, reason: "INVALID_REGION" };

  const ink = new Float32Array(W * H);
  for (let gy = 0; gy < H; gy++) {
    for (let gx = 0; gx < W; gx++) {
      let sum = 0;
      for (let dy = 0; dy < cellSize; dy++) {
        let i = ((y0 + gy * cellSize + dy) * imgW + x0 + gx * cellSize) * 4;
        for (let dx = 0; dx < cellSize; dx++, i += 4) {
          const lum =
            0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          sum += ((255 - lum) * data[i + 3]) / 255;
        }
      }
      ink[gy * W + gx] = sum / (cellSize * cellSize);
    }
  }

  // --- 2. blur ---

  const field = boxBlur(boxBlur(ink, W, H, blurRadius), W, H, blurRadius);

  // --- 3. zone mask (grid nodes = cell centres) and frontier level ---

  // strokes in grid coordinates
  const mask = rasterizeStrokes(
    zone.map(({ points, radius }) => ({
      radius: radius / cellSize,
      points: points.map((p) => ({
        x: (p.x - x0) / cellSize - 0.5,
        y: (p.y - y0) / cellSize - 0.5,
      })),
    })),
    W,
    H
  );

  const histogram = new Float64Array(256);
  let count = 0;
  for (let i = 0; i < field.length; i++) {
    if (!mask[i]) continue;
    histogram[Math.max(0, Math.min(255, Math.round(field[i])))] += 1;
    count += 1;
  }
  if (count < 4) return { points: null, reason: "INVALID_REGION" };

  const classes = otsuClasses(histogram, count);
  if (!classes || classes.highMean - classes.lowMean < minContrast) {
    return { points: null, reason: "NO_BOUNDARY" };
  }
  const level = (classes.lowMean + classes.highMean) / 2;

  // --- 4. marching squares ---

  const chains = traceIsoChains(field, mask, W, H, level);

  // --- 5. longest chain ---

  let best = null;
  let bestLength = 0;
  for (const chain of chains) {
    let length = 0;
    for (let i = 1; i < chain.points.length; i++) {
      length += Math.hypot(
        chain.points[i].x - chain.points[i - 1].x,
        chain.points[i].y - chain.points[i - 1].y
      );
    }
    if (length > bestLength) {
      bestLength = length;
      best = chain;
    }
  }
  if (!best || bestLength < minLengthCells) {
    return { points: null, reason: "NO_BOUNDARY" };
  }

  return {
    points: best.points.map((p) => ({
      x: x0 + (p.x + 0.5) * cellSize,
      y: y0 + (p.y + 0.5) * cellSize,
    })),
    closed: best.closed,
    cellSize,
    blurRadiusPx: blurRadius * cellSize,
  };
}

// Separable box blur (edge values replicated).
function boxBlur(src, W, H, radius) {
  if (!(radius > 0)) return src;
  const size = 2 * radius + 1;
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      sum += src[row + Math.max(0, Math.min(W - 1, k))];
    }
    for (let x = 0; x < W; x++) {
      tmp[row + x] = sum / size;
      sum +=
        src[row + Math.min(W - 1, x + radius + 1)] -
        src[row + Math.max(0, x - radius)];
    }
  }
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      sum += tmp[Math.max(0, Math.min(H - 1, k)) * W + x];
    }
    for (let y = 0; y < H; y++) {
      out[y * W + x] = sum / size;
      sum +=
        tmp[Math.min(H - 1, y + radius + 1) * W + x] -
        tmp[Math.max(0, y - radius) * W + x];
    }
  }
  return out;
}

// mask[gy * W + gx] = 1 when the node lies within `radius` of the axis of
// one of the strokes (grid coordinates).
function rasterizeStrokes(strokes, W, H) {
  const mask = new Uint8Array(W * H);
  const fillCapsule = (a, b, radius) => {
    const gx0 = Math.max(0, Math.ceil(Math.min(a.x, b.x) - radius));
    const gx1 = Math.min(W - 1, Math.floor(Math.max(a.x, b.x) + radius));
    const gy0 = Math.max(0, Math.ceil(Math.min(a.y, b.y) - radius));
    const gy1 = Math.min(H - 1, Math.floor(Math.max(a.y, b.y) + radius));
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const t =
          lengthSq > 0
            ? Math.max(
                0,
                Math.min(1, ((gx - a.x) * dx + (gy - a.y) * dy) / lengthSq)
              )
            : 0;
        const ex = gx - a.x - t * dx;
        const ey = gy - a.y - t * dy;
        if (ex * ex + ey * ey <= radius * radius) mask[gy * W + gx] = 1;
      }
    }
  };
  for (const { points, radius } of strokes) {
    // the samples closer than half a cell add nothing to the mask
    let last = points[0];
    fillCapsule(last, last, radius);
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const isLast = i === points.length - 1;
      if (!isLast && Math.hypot(p.x - last.x, p.y - last.y) < 0.5) continue;
      fillCapsule(last, p, radius);
      last = p;
    }
  }
  return mask;
}

// Otsu split of a 256-bin histogram → means of the two classes.
export function otsuClasses(histogram, count) {
  let total = 0;
  for (let v = 0; v < 256; v++) total += v * histogram[v];
  let lowCount = 0;
  let lowSum = 0;
  let bestVariance = -1;
  let best = null;
  for (let v = 0; v < 255; v++) {
    lowCount += histogram[v];
    lowSum += v * histogram[v];
    const highCount = count - lowCount;
    if (lowCount === 0 || highCount === 0) continue;
    const lowMean = lowSum / lowCount;
    const highMean = (total - lowSum) / highCount;
    const variance = lowCount * highCount * (highMean - lowMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      best = { lowMean, highMean };
    }
  }
  return best;
}

// Marching squares at `level`, in the cells whose 4 nodes are in the mask.
// Returns chains of points in grid coordinates (node = integer position):
// [{ points, closed }].
function traceIsoChains(field, mask, W, H, level) {
  // Grid edges carrying a crossing: horizontal edge (x, y)-(x+1, y) has id
  // 2 * (y * W + x), vertical edge (x, y)-(x, y+1) has id 2 * (y * W + x) + 1.
  const links = new Map(); // edge id -> linked edge ids (1 or 2)
  const link = (a, b) => {
    if (!links.has(a)) links.set(a, []);
    if (!links.has(b)) links.set(b, []);
    links.get(a).push(b);
    links.get(b).push(a);
  };

  for (let y = 0; y + 1 < H; y++) {
    for (let x = 0; x + 1 < W; x++) {
      const i00 = y * W + x;
      const i10 = i00 + 1;
      const i01 = i00 + W;
      const i11 = i01 + 1;
      if (!mask[i00] || !mask[i10] || !mask[i01] || !mask[i11]) continue;
      const code =
        (field[i00] >= level ? 1 : 0) |
        (field[i10] >= level ? 2 : 0) |
        (field[i11] >= level ? 4 : 0) |
        (field[i01] >= level ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const top = 2 * i00;
      const left = 2 * i00 + 1;
      const right = 2 * i10 + 1;
      const bottom = 2 * i01;
      switch (code) {
        case 1:
        case 14:
          link(top, left);
          break;
        case 2:
        case 13:
          link(top, right);
          break;
        case 4:
        case 11:
          link(right, bottom);
          break;
        case 8:
        case 7:
          link(left, bottom);
          break;
        case 3:
        case 12:
          link(left, right);
          break;
        case 6:
        case 9:
          link(top, bottom);
          break;
        default: {
          // saddle (5, 10): the cell centre decides which corners connect
          const centre =
            (field[i00] + field[i10] + field[i01] + field[i11]) / 4;
          const joinsHigh = centre >= level;
          if ((code === 5) === joinsHigh) {
            link(top, right);
            link(left, bottom);
          } else {
            link(top, left);
            link(right, bottom);
          }
        }
      }
    }
  }

  const edgePoint = (id) => {
    const node = id >> 1;
    const x = node % W;
    const y = (node - x) / W;
    const a = field[node];
    if (id & 1) {
      const b = field[node + W];
      return { x, y: y + (level - a) / (b - a) };
    }
    const b = field[node + 1];
    return { x: x + (level - a) / (b - a), y };
  };

  const visited = new Set();
  const walk = (start) => {
    const ids = [start];
    visited.add(start);
    let current = start;
    for (;;) {
      const next = links.get(current).find((id) => !visited.has(id));
      if (next === undefined) break;
      visited.add(next);
      ids.push(next);
      current = next;
    }
    return ids;
  };

  const chains = [];
  // open chains first (they start on an edge with a single link)
  for (const [id, linked] of links) {
    if (linked.length !== 1 || visited.has(id)) continue;
    chains.push({ points: walk(id).map(edgePoint), closed: false });
  }
  for (const id of links.keys()) {
    if (visited.has(id)) continue;
    const points = walk(id).map(edgePoint);
    points.push({ ...points[0] });
    chains.push({ points, closed: true });
  }
  return chains;
}
