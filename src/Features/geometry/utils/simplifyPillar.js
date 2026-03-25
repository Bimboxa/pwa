/**
 * Simplify a small polygon (pillar/column) to a clean shape.
 *
 * Detects whether the pillar is rectangular or circular based on the
 * ratio of polygon area to bounding box area, then returns the
 * appropriate simplified geometry.
 *
 * For rectangular pillars: returns 4 AABB corners (type: "square").
 * For circular pillars: returns 4 points in S-C-S-C pattern at
 * 0°/90°/180°/270° for arc rendering.
 *
 * @param {Array<{x: number, y: number}>} points - Polygon vertices (in axis-aligned rotated space)
 * @param {Object} [options]
 * @param {number} [options.maxDiagonalM=1.0] - Max diagonal in meters to qualify as pillar
 * @param {number} [options.meterByPx=0] - Scale (meters per pixel). 0 = use fallbackMaxDiagonal.
 * @param {number} [options.fallbackMaxDiagonal=Infinity] - Fallback pixel threshold when no scale is available
 * @param {number} [options.circularityThreshold=0.85] - Area ratio above this = rectangular, below = circular candidate
 * @param {number} [options.circularityMin=0.65] - Area ratio below this = irregular shape, skip simplification
 * @returns {{ points: Array<{x: number, y: number, type?: string}>, simplified: boolean }}
 */
export default function simplifyPillar(points, options = {}) {
  const {
    maxDiagonalM = 1.0,
    meterByPx = 0,
    fallbackMaxDiagonal = Infinity,
    circularityThreshold = 0.85,
    circularityMin = 0.65,
  } = options;

  const result = { points, simplified: false };

  if (!points || points.length < 3) return result;

  // -- Step 1: compute bbox and check if small enough to be a pillar
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  const diag = Math.sqrt(bboxW * bboxW + bboxH * bboxH);

  if (diag < 1e-6) return result;

  const maxDiagPx = meterByPx > 0 ? maxDiagonalM / meterByPx : fallbackMaxDiagonal;
  if (diag > maxDiagPx) return result;

  // -- Step 2: compute polygon area and circularity ratio
  const polyArea = Math.abs(computeSignedArea(points));
  const bboxArea = bboxW * bboxH;

  if (bboxArea < 1e-6) return result;

  const areaRatio = polyArea / bboxArea;

  // -- Step 3: classify and simplify
  if (areaRatio >= circularityThreshold) {
    // Rectangular pillar → return AABB corners
    return {
      points: [
        { x: minX, y: minY, type: "square" },
        { x: maxX, y: minY, type: "square" },
        { x: maxX, y: maxY, type: "square" },
        { x: minX, y: maxY, type: "square" },
      ],
      simplified: true,
    };
  }

  if (areaRatio >= circularityMin) {
    // Circular pillar → return 4 points S-C-S-C at 0°/90°/180°/270°
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rx = bboxW / 2;
    const ry = bboxH / 2;

    return {
      points: [
        { x: cx + rx, y: cy, type: "square" },     // 0° (right)
        { x: cx, y: cy + ry, type: "circle" },      // 90° (bottom)
        { x: cx - rx, y: cy, type: "square" },      // 180° (left)
        { x: cx, y: cy - ry, type: "circle" },      // 270° (top)
      ],
      simplified: true,
    };
  }

  // Irregular shape — do not simplify
  return result;
}

/**
 * Compute the signed area of a polygon using the shoelace formula.
 */
function computeSignedArea(points) {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}
