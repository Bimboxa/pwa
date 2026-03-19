/**
 * Worker handler for BFS-based orthogonal path tracing.
 *
 * Follows dark lines from a click point in all orthogonal directions,
 * forking at intersections and stopping on visited pixels or empty space.
 */
async function traceOrthoPathsAsync({ msg, payload }) {
  try {
    const {
      imageUrl,
      clickX,
      clickY,
      visitedSegments = [],
      darknessThreshold = 128,
      windowSize = 6,
    } = payload;

    if (!imageUrl) throw new Error("imageUrl is required");

    // 1. Load image data
    const imageData = await loadImageDataFromUrl(imageUrl);
    const { width, height, data } = imageData;
    const half = Math.floor(windowSize / 2);

    // 2. Measure line thickness at click point to determine stepSize
    //    This is needed to rasterize existing segments with the correct radius.
    const stepSize = _measureStepSizeAtClick({
      data, width, height, clickX, clickY, darknessThreshold, half,
    });

    // 3. Build visited map from previously committed segments
    //    Use stepSize as the rasterization radius so the BFS cannot step past them.
    const visitedMap = new Uint8Array(width * height);
    if (visitedSegments.length > 0) {
      const rasterRadius = stepSize;
      for (const seg of visitedSegments) {
        for (let i = 0; i < seg.length - 1; i++) {
          rasterizeSegment(visitedMap, width, height, seg[i], seg[i + 1], rasterRadius);
        }
      }
    }

    // 4. Run BFS algorithm
    const polylines = _traceOrthoPaths({
      data, width, height, clickX, clickY,
      visitedMap, darknessThreshold, half,
    });

    postMessage({ msg, payload: polylines });
  } catch (err) {
    postMessage({ msg, error: err.message || String(err) });
  }
}

/**
 * Pre-compute stepSize from the click point so we can rasterize
 * existing segments with the correct exclusion radius.
 */
function _measureStepSizeAtClick({ data, width, height, clickX, clickY, darknessThreshold, half }) {
  function brightness(px, py) {
    const rx = Math.round(px);
    const ry = Math.round(py);
    if (rx < 0 || ry < 0 || rx >= width || ry >= height) return 255;
    const idx = (ry * width + rx) * 4;
    return data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
  }

  function avgBrightness(cx, cy) {
    let sum = 0;
    let count = 0;
    const x0 = Math.max(0, Math.round(cx) - half);
    const y0 = Math.max(0, Math.round(cy) - half);
    const x1 = Math.min(width - 1, Math.round(cx) + half);
    const y1 = Math.min(height - 1, Math.round(cy) + half);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = (y * width + x) * 4;
        sum += data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        count++;
      }
    }
    return count > 0 ? sum / count : 255;
  }

  function isDark(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) return false;
    return avgBrightness(cx, cy) < darknessThreshold;
  }

  // Snap to nearest dark pixel (same logic as in BFS)
  let sx = Math.round(clickX);
  let sy = Math.round(clickY);
  if (!isDark(sx, sy)) {
    let found = false;
    for (let r = 1; r <= 30 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          if (isDark(sx + dx, sy + dy)) {
            sx += dx;
            sy += dy;
            found = true;
          }
        }
      }
    }
    if (!found) return 6; // fallback
  }

  // Measure thickness
  let maxH = 0, maxV = 0;
  for (let d = 1; d < 100; d++) {
    if (brightness(sx + d, sy) < darknessThreshold) maxH = d; else break;
  }
  for (let d = 1; d < 100; d++) {
    if (brightness(sx - d, sy) < darknessThreshold) maxH = d; else break;
  }
  for (let d = 1; d < 100; d++) {
    if (brightness(sx, sy + d) < darknessThreshold) maxV = d; else break;
  }
  for (let d = 1; d < 100; d++) {
    if (brightness(sx, sy - d) < darknessThreshold) maxV = d; else break;
  }
  const thickness = Math.min(maxH, maxV) * 2 + 1;
  return Math.max(thickness, 6);
}

// --- Core algorithm ---

function _traceOrthoPaths({
  data, width, height, clickX, clickY,
  visitedMap, darknessThreshold, half,
}) {

  // --- pixel helpers ---

  function brightness(px, py) {
    const rx = Math.round(px);
    const ry = Math.round(py);
    if (rx < 0 || ry < 0 || rx >= width || ry >= height) return 255;
    const idx = (ry * width + rx) * 4;
    return data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
  }

  /** Average brightness in a small window. */
  function avgBrightness(cx, cy) {
    let sum = 0;
    let count = 0;
    const x0 = Math.max(0, Math.round(cx) - half);
    const y0 = Math.max(0, Math.round(cy) - half);
    const x1 = Math.min(width - 1, Math.round(cx) + half);
    const y1 = Math.min(height - 1, Math.round(cy) + half);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = (y * width + x) * 4;
        sum += data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        count++;
      }
    }
    return count > 0 ? sum / count : 255;
  }

  function isDark(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) return false;
    return avgBrightness(cx, cy) < darknessThreshold;
  }

  function markVisited(cx, cy) {
    const rx = Math.round(cx);
    const ry = Math.round(cy);
    if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
      visitedMap[ry * width + rx] = 1;
    }
  }

  function isVisited(cx, cy) {
    const rx = Math.round(cx);
    const ry = Math.round(cy);
    if (rx < 0 || rx >= width || ry < 0 || ry >= height) return true;
    return visitedMap[ry * width + rx] === 1;
  }

  // --- Auto-detect line thickness at click point ---

  function measureThickness(cx, cy) {
    // Measure how many dark pixels in each direction from center
    let maxH = 0;
    let maxV = 0;
    for (let d = 1; d < 100; d++) {
      if (brightness(cx + d, cy) < darknessThreshold) maxH = d;
      else break;
    }
    for (let d = 1; d < 100; d++) {
      if (brightness(cx - d, cy) < darknessThreshold) maxH = d;
      else break;
    }
    for (let d = 1; d < 100; d++) {
      if (brightness(cx, cy + d) < darknessThreshold) maxV = d;
      else break;
    }
    for (let d = 1; d < 100; d++) {
      if (brightness(cx, cy - d) < darknessThreshold) maxV = d;
      else break;
    }
    // The line thickness is the SMALLER dimension (the other is line length)
    const thickness = Math.min(maxH, maxV) * 2 + 1;
    return Math.max(thickness, 3); // at least 3px
  }

  // --- directions ---

  const DIRS = [
    { dx: 0, dy: -1 }, // N
    { dx: 0, dy: 1 },  // S
    { dx: -1, dy: 0 }, // W
    { dx: 1, dy: 0 },  // E
  ];

  function perpendicularDirs(dir) {
    if (dir.dx === 0) return DIRS.filter((d) => d.dy === 0);
    return DIRS.filter((d) => d.dx === 0);
  }

  // --- Snap click to nearest dark pixel ---

  let startX = Math.round(clickX);
  let startY = Math.round(clickY);
  if (!isDark(startX, startY)) {
    let found = false;
    for (let r = 1; r <= 30 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          if (isDark(startX + dx, startY + dy)) {
            startX += dx;
            startY += dy;
            found = true;
          }
        }
      }
    }
    if (!found) return [];
  }

  // --- Snap to band center (median line) ---
  {
    let le = 0, re = 0, te = 0, be = 0;
    for (let d = 1; d < 200; d++) { if (brightness(startX - d, startY) < darknessThreshold) le = d; else break; }
    for (let d = 1; d < 200; d++) { if (brightness(startX + d, startY) < darknessThreshold) re = d; else break; }
    for (let d = 1; d < 200; d++) { if (brightness(startX, startY - d) < darknessThreshold) te = d; else break; }
    for (let d = 1; d < 200; d++) { if (brightness(startX, startY + d) < darknessThreshold) be = d; else break; }
    const hExt = le + re + 1;
    const vExt = te + be + 1;
    if (hExt <= vExt) {
      // Band runs vertically — center horizontally
      startX = startX - le + Math.floor(hExt / 2);
    } else {
      // Band runs horizontally — center vertically
      startY = startY - te + Math.floor(vExt / 2);
    }
  }

  // Step size = line thickness (so we jump past the line width on each step)
  const lineThickness = measureThickness(startX, startY);
  const stepSize = Math.max(lineThickness, 6);

  // --- BFS ---

  const queue = [];
  const segments = [];

  markVisited(startX, startY);
  for (const dir of DIRS) {
    const nx = startX + dir.dx * stepSize;
    const ny = startY + dir.dy * stepSize;
    if (isDark(nx, ny)) {
      queue.push({
        x: startX, y: startY, dir,
        path: [{ x: startX, y: startY }],
      });
    }
  }

  const MAX_ITERATIONS = 200000;
  let iterations = 0;

  while (queue.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const task = queue.shift();
    const { dir, path } = task;
    let { x, y } = task;

    const nx = x + dir.dx * stepSize;
    const ny = y + dir.dy * stepSize;

    // Out of bounds
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
      if (path.length >= 2) segments.push(path);
      continue;
    }

    // Already visited
    if (isVisited(nx, ny)) {
      path.push({ x: nx, y: ny });
      if (path.length >= 2) segments.push(path);
      continue;
    }

    // No dark pixels ahead
    if (!isDark(nx, ny)) {
      if (path.length >= 2) segments.push(path);
      continue;
    }

    // Advance
    markVisited(nx, ny);
    path.push({ x: nx, y: ny });
    x = nx;
    y = ny;

    // Check perpendicular branches — require dark pixels at BOTH 1× and 2× stepSize
    // to confirm it's a real intersection, not just line thickness
    for (const pDir of perpendicularDirs(dir)) {
      const bx1 = x + pDir.dx * stepSize;
      const by1 = y + pDir.dy * stepSize;
      const bx2 = x + pDir.dx * stepSize * 2;
      const by2 = y + pDir.dy * stepSize * 2;
      if (isDark(bx1, by1) && isDark(bx2, by2) && !isVisited(bx1, by1)) {
        queue.push({ x, y, dir: pDir, path: [{ x, y }] });
      }
    }

    // Continue forward
    queue.push({ x, y, dir, path });
  }

  const simplified = segments.map(simplifyPolyline).filter((s) => s.length >= 2);

  // --- Reconstruct the longest continuous polyline through the start point ---
  const best = findLongestPathThroughStart(simplified, startX, startY, stepSize);
  const result = best ? [best] : simplified;

  // --- Adjust the FINAL polyline to run along the band's median line ---
  return result.map((seg) =>
    adjustSegmentsToMiddleLine(seg, brightness, darknessThreshold, width, height)
  );
}

function simplifyPolyline(points) {
  if (points.length <= 2) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];
    const dx1 = Math.sign(curr.x - prev.x);
    const dy1 = Math.sign(curr.y - prev.y);
    const dx2 = Math.sign(next.x - curr.x);
    const dy2 = Math.sign(next.y - curr.y);
    if (dx1 !== dx2 || dy1 !== dy2) {
      result.push(curr);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Adjust each segment of a simplified polyline to run along the band's median line.
 *
 * For each segment, compute the median perpendicular coordinate (band center).
 * Corner points are the INTERSECTION of consecutive median lines:
 *   H segment (y = Y) ∩ V segment (x = X) → corner at (X, Y)
 * This guarantees all segments remain perfectly orthogonal.
 */
function adjustSegmentsToMiddleLine(poly, brightness, darknessThreshold, imgWidth, imgHeight) {
  if (poly.length < 2) return poly;

  // --- Step 0: Force each segment to be strictly H or V ---
  // Classify each segment, then snap: H → same Y for both ends, V → same X.
  const dirs = []; // true = H, false = V
  for (let i = 0; i < poly.length - 1; i++) {
    dirs.push(Math.abs(poly[i + 1].x - poly[i].x) >= Math.abs(poly[i + 1].y - poly[i].y));
  }

  // Force orthogonal: snap minor axis to the start point's value
  const snapped = [{ ...poly[0] }];
  for (let i = 0; i < dirs.length; i++) {
    const p0 = snapped[snapped.length - 1];
    const p1 = poly[i + 1];
    if (dirs[i]) {
      // H → force same Y as p0
      snapped.push({ x: p1.x, y: p0.y });
    } else {
      // V → force same X as p0
      snapped.push({ x: p0.x, y: p1.y });
    }
  }

  // --- Step 1: Merge consecutive same-direction segments ---
  const merged = [snapped[0]];
  const mergedDirs = [];
  for (let i = 1; i < snapped.length; i++) {
    const currDir = dirs[i - 1];
    if (mergedDirs.length > 0 && mergedDirs[mergedDirs.length - 1] === currDir) {
      merged[merged.length - 1] = snapped[i]; // replace endpoint
    } else {
      merged.push(snapped[i]);
      mergedDirs.push(currDir);
    }
  }
  if (merged.length < 2) return merged;

  // --- Step 2: For each segment, sample 4 points to find band median ---
  function findBandCenter(p0, p1, isH) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const centers = [];
    for (let k = 0; k < 4; k++) {
      const t = (k + 0.5) / 4;
      const sx = Math.round(p0.x + dx * t);
      const sy = Math.round(p0.y + dy * t);
      if (isH) {
        let top = 0, bot = 0;
        for (let d = 1; d < 200; d++) { if (sy - d >= 0 && brightness(sx, sy - d) < darknessThreshold) top = d; else break; }
        for (let d = 1; d < 200; d++) { if (sy + d < imgHeight && brightness(sx, sy + d) < darknessThreshold) bot = d; else break; }
        centers.push(sy - top + Math.floor((top + bot + 1) / 2));
      } else {
        let le = 0, ri = 0;
        for (let d = 1; d < 200; d++) { if (sx - d >= 0 && brightness(sx - d, sy) < darknessThreshold) le = d; else break; }
        for (let d = 1; d < 200; d++) { if (sx + d < imgWidth && brightness(sx + d, sy) < darknessThreshold) ri = d; else break; }
        centers.push(sx - le + Math.floor((le + ri + 1) / 2));
      }
    }
    return Math.round(centers.reduce((a, b) => a + b, 0) / centers.length);
  }

  const segMedians = [];
  for (let i = 0; i < mergedDirs.length; i++) {
    segMedians.push({
      isH: mergedDirs[i],
      center: findBandCenter(merged[i], merged[i + 1], mergedDirs[i]),
    });
  }

  // --- Step 3: Build result using intersections of consecutive median lines ---
  const result = [];

  // First point
  const f = segMedians[0];
  result.push(f.isH ? { x: merged[0].x, y: f.center } : { x: f.center, y: merged[0].y });

  // Corners = intersection of adjacent median lines
  for (let i = 1; i < merged.length - 1; i++) {
    const prev = segMedians[i - 1];
    const curr = segMedians[i];
    if (prev.isH && !curr.isH) {
      result.push({ x: curr.center, y: prev.center });
    } else if (!prev.isH && curr.isH) {
      result.push({ x: prev.center, y: curr.center });
    } else {
      // Same direction after merge (shouldn't happen)
      result.push({ ...merged[i] });
    }
  }

  // Last point
  const l = segMedians[segMedians.length - 1];
  result.push(l.isH ? { x: merged[merged.length - 1].x, y: l.center } : { x: l.center, y: merged[merged.length - 1].y });

  // --- Step 4: Ensure first and last points are strictly aligned with their segment ---
  // The first point must share the perpendicular coordinate of the second point (same segment)
  if (result.length >= 2) {
    const p0 = result[0];
    const p1 = result[1];
    if (f.isH) {
      // First segment is H → both must have same Y
      result[0] = { x: p0.x, y: p1.y };
    } else {
      // First segment is V → both must have same X
      result[0] = { x: p1.x, y: p0.y };
    }
  }
  if (result.length >= 2) {
    const pN = result[result.length - 1];
    const pN1 = result[result.length - 2];
    if (l.isH) {
      result[result.length - 1] = { x: pN.x, y: pN1.y };
    } else {
      result[result.length - 1] = { x: pN1.x, y: pN.y };
    }
  }

  return result;
}

/**
 * Find the longest continuous polyline passing through the start point.
 *
 * Strategy:
 * 1. Build adjacency index: for each segment's first point, store the segment index
 * 2. Identify "root" segments (starting at the click point)
 * 3. For each root segment, extend its end by following connected segments (greedy DFS)
 * 4. Try all pairs of root segments going in opposite directions, merge them
 * 5. Return the longest merged polyline
 */
function findLongestPathThroughStart(segments, startX, startY, stepSize) {
  if (segments.length === 0) return null;
  if (segments.length === 1) return segments[0];

  const tolerance = stepSize * 1.5;

  function ptKey(p) {
    // Round to stepSize grid for matching
    const gx = Math.round(p.x / stepSize) * stepSize;
    const gy = Math.round(p.y / stepSize) * stepSize;
    return gx + "," + gy;
  }

  function near(a, b) {
    return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
  }

  function segLength(seg) {
    let len = 0;
    for (let i = 1; i < seg.length; i++) {
      const dx = seg[i].x - seg[i - 1].x;
      const dy = seg[i].y - seg[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }

  // Build adjacency: map from first-point key → list of segment indices
  const startIndex = {};
  for (let i = 0; i < segments.length; i++) {
    const key = ptKey(segments[i][0]);
    if (!startIndex[key]) startIndex[key] = [];
    startIndex[key].push(i);
  }

  // Extend a polyline from its last point by following connected segments
  function extend(path, usedSet) {
    let current = path;
    for (let iter = 0; iter < 1000; iter++) {
      const endPt = current[current.length - 1];
      const key = ptKey(endPt);
      const candidates = startIndex[key] || [];
      let bestSeg = null;
      let bestLen = 0;
      for (const idx of candidates) {
        if (usedSet.has(idx)) continue;
        if (!near(segments[idx][0], endPt)) continue;
        const len = segLength(segments[idx]);
        if (len > bestLen) { bestLen = len; bestSeg = idx; }
      }
      if (bestSeg === null) break;
      usedSet.add(bestSeg);
      // Append segment (skip first point as it overlaps with current end)
      current = [...current, ...segments[bestSeg].slice(1)];
    }
    return current;
  }

  const startPt = { x: startX, y: startY };

  // Find root segments (those starting at click point)
  const rootIndices = [];
  for (let i = 0; i < segments.length; i++) {
    if (near(segments[i][0], startPt)) {
      rootIndices.push(i);
    }
  }

  if (rootIndices.length === 0) return segments[0]; // fallback

  let bestPath = null;
  let bestLen = 0;

  // Try each pair of root segments: reverse(A) + B, then extend both ends
  for (let a = 0; a < rootIndices.length; a++) {
    for (let b = a; b < rootIndices.length; b++) {
      const idxA = rootIndices[a];
      const idxB = rootIndices[b];
      const used = new Set([idxA, idxB]);

      let merged;
      if (a === b) {
        // Single root segment — just extend
        merged = [...segments[idxA]];
      } else {
        // Merge: reverse(A) + B (skip duplicate start point)
        const revA = [...segments[idxA]].reverse();
        merged = [...revA, ...segments[idxB].slice(1)];
      }

      // Extend the start (beginning of merged)
      const revMerged = [...merged].reverse();
      const extStart = extend(revMerged, new Set(used));
      const fullyExtended = [...extStart].reverse();

      // Extend the end
      const final = extend(fullyExtended, used);

      const len = segLength(final);
      if (len > bestLen) {
        bestLen = len;
        bestPath = final;
      }
    }
  }

  return bestPath || segments[0];
}

/**
 * Rasterize a line segment into the visited map using Bresenham-like stepping.
 */
function rasterizeSegment(visitedMap, width, height, p0, p1, half) {
  const dx = Math.abs(p1.x - p0.x);
  const dy = Math.abs(p1.y - p0.y);
  const sx = p0.x < p1.x ? 1 : -1;
  const sy = p0.y < p1.y ? 1 : -1;
  let err = dx - dy;
  let cx = Math.round(p0.x);
  let cy = Math.round(p0.y);
  const ex = Math.round(p1.x);
  const ey = Math.round(p1.y);

  for (let i = 0; i < 100000; i++) {
    const x0 = Math.max(0, cx - half);
    const y0 = Math.max(0, cy - half);
    const x1 = Math.min(width - 1, cx + half);
    const y1 = Math.min(height - 1, cy + half);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        visitedMap[y * width + x] = 1;
      }
    }
    if (cx === ex && cy === ey) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
}
