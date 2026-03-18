/**
 * traceOrthoPaths — BFS-based orthogonal path tracer.
 *
 * Follows dark (black) lines from a click point in all orthogonal directions,
 * forking at intersections and stopping on already-visited pixels or empty space.
 *
 * NOTE: The actual runtime version is in public/opencv/handlers/traceOrthoPathsAsync.js
 * (inlined for Web Worker compatibility). Keep both in sync.
 *
 * @param {Object} params
 * @param {ImageData} params.imageData — full base-map pixel buffer
 * @param {number} params.clickX — click X in image-pixel coords
 * @param {number} params.clickY — click Y in image-pixel coords
 * @param {Uint8Array|null} params.visitedMap — previously committed pixels (1 = visited)
 * @param {number} [params.darknessThreshold=128] — max brightness (0-255) to consider "dark"
 * @param {number} [params.windowSize=6] — side length of the sampling window for isDark
 * @returns {Array<Array<{x:number, y:number}>>} array of simplified polylines
 */
export default function traceOrthoPaths({
  imageData,
  clickX,
  clickY,
  visitedMap,
  darknessThreshold = 128,
  windowSize = 6,
}) {
  const { width, height, data } = imageData;
  const half = Math.floor(windowSize / 2);

  if (!visitedMap) {
    visitedMap = new Uint8Array(width * height);
  }

  // --- helpers ---

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

  // --- Auto-detect line thickness ---

  function measureThickness(cx, cy) {
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
    const thickness = Math.min(maxH, maxV) * 2 + 1;
    return Math.max(thickness, 3);
  }

  // --- directions ---

  const DIRS = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  function perpendicularDirs(dir) {
    if (dir.dx === 0) return DIRS.filter((d) => d.dy === 0);
    return DIRS.filter((d) => d.dx === 0);
  }

  // --- Snap click ---

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

    if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
      if (path.length >= 2) segments.push(path);
      continue;
    }

    if (isVisited(nx, ny)) {
      path.push({ x: nx, y: ny });
      if (path.length >= 2) segments.push(path);
      continue;
    }

    if (!isDark(nx, ny)) {
      if (path.length >= 2) segments.push(path);
      continue;
    }

    markVisited(nx, ny);
    path.push({ x: nx, y: ny });
    x = nx;
    y = ny;

    // Perpendicular branches: require 2× stepSize ahead to confirm real intersection
    for (const pDir of perpendicularDirs(dir)) {
      const bx1 = x + pDir.dx * stepSize;
      const by1 = y + pDir.dy * stepSize;
      const bx2 = x + pDir.dx * stepSize * 2;
      const by2 = y + pDir.dy * stepSize * 2;
      if (isDark(bx1, by1) && isDark(bx2, by2) && !isVisited(bx1, by1)) {
        queue.push({ x, y, dir: pDir, path: [{ x, y }] });
      }
    }

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
