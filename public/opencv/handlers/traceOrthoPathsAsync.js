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

  return segments.map(simplifyPolyline).filter((s) => s.length >= 2);
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
