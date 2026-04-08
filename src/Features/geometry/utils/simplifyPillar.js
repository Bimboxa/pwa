// ─── Pillar detection thresholds ─────────────────────────────────────
// These values define what counts as a "pillar" and how to classify it.

/** Max bounding-box diagonal (meters) for a polygon to be considered a pillar. */
const PILLAR_MAX_DIAGONAL_M = 5.0;

/**
 * Diamond detection threshold: area ratio below AREA_RATIO_CIRCULAR but above
 * this value, combined with few vertices (≤ 6), indicates a diamond artifact
 * from OpenCV's approxPolyDP (vertices land at edge midpoints instead of
 * corners). The AABB of such a diamond IS the correct pillar rectangle.
 *
 * Reference: a perfect diamond inscribed in its AABB has ratio = 0.50.
 */
const AREA_RATIO_DIAMOND = 0.40;

/** Max vertex count to qualify for diamond detection. */
const DIAMOND_MAX_VERTICES = 6;

/** Min wall thickness (meters). Used as minimum resolution reference. */
const MIN_WALL_THICKNESS_M = 0.15;

/**
 * Area ratio (polygon area / bbox area) thresholds:
 *   - ratio >= RECTANGULAR → rectangular pillar (square/rectangle)
 *   - CIRCULAR <= ratio < RECTANGULAR → circular pillar
 *   - ratio < CIRCULAR → irregular shape, skip
 *
 * Reference values:
 *   - Perfect square:  1.0
 *   - Square with rounded corners: ~0.9
 *   - Perfect circle inscribed in bbox: π/4 ≈ 0.785
 *   - Octagon inscribed in bbox: ~0.828
 */
const AREA_RATIO_RECTANGULAR = 0.85;
const AREA_RATIO_CIRCULAR = 0.65;

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
 * @param {number} [options.maxDiagonalM=PILLAR_MAX_DIAGONAL_M] - Max diagonal in meters to qualify as pillar
 * @param {number} [options.meterByPx=0] - Scale (meters per pixel). 0 = use fallbackMaxDiagonal.
 * @param {number} [options.fallbackMaxDiagonal=Infinity] - Fallback pixel threshold when no scale is available
 * @param {number} [options.circularityThreshold=AREA_RATIO_RECTANGULAR] - Area ratio above this = rectangular
 * @param {number} [options.circularityMin=AREA_RATIO_CIRCULAR] - Area ratio below this = irregular shape
 * @param {number} [options.diamondThreshold=AREA_RATIO_DIAMOND] - Area ratio above this with few vertices = diamond artifact → rectangular
 * @returns {{ points: Array<{x: number, y: number, type?: string}>, simplified: boolean }}
 */
export default function simplifyPillar(points, options = {}) {
  const {
    maxDiagonalM = PILLAR_MAX_DIAGONAL_M,
    meterByPx = 0,
    fallbackMaxDiagonal = Infinity,
    circularityThreshold = AREA_RATIO_RECTANGULAR,
    circularityMin = AREA_RATIO_CIRCULAR,
    diamondThreshold = AREA_RATIO_DIAMOND,
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

  // Few-vertex polygons (≤ 6): circular classification is unreliable because
  // OpenCV's approxPolyDP produces diamonds/pentagons for rectangular pillars.
  // Grid snapping can further distort the shape, pushing the area ratio into
  // the circular range (0.65–0.85) even though the pillar is rectangular.
  // With so few vertices, replacing with AABB is always the right call.
  if (points.length <= DIAMOND_MAX_VERTICES && areaRatio >= diamondThreshold) {
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

  if (areaRatio >= circularityThreshold) {
    // Rectangular pillar (ratio >= 0.85) → return AABB corners
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
    // Circular pillar (0.65–0.85, 7+ vertices) → return 4 points S-C-S-C at 0°/90°/180°/270°
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
