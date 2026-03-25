import simplifyPillar from "./simplifyPillar";

/**
 * Align all polygons (main contour + cuts) to a shared orthogonal grid.
 *
 * Building floor plans have walls meeting at right angles. After OpenCV contour
 * detection (SURFACE_DROP), vertices from the main contour and cut polygons
 * (pillars, columns) should share a common coordinate grid. This function:
 * 1. Determines the dominant wall orientation (from user angle or auto-detect)
 * 2. Rotates everything to axis-aligned space
 * 3. Clusters X/Y coordinates across ALL polygons to build a shared grid
 * 4. Snaps eligible vertices to grid intersections
 * 5. Rotates back and cleans up
 *
 * @param {Array<{x: number, y: number}>} mainPoints - Main contour vertices
 * @param {Array<{points: Array<{x: number, y: number}>, ...}>|null|undefined} cuts - Cut polygons
 * @param {Object} [options]
 * @param {number|null} [options.referenceAngle=null] - Grid base angle in DEGREES (from orthoSnapAngleOffset). null = auto-detect.
 * @param {number} [options.gridToleranceRatio=0.015] - Grid clustering tolerance as ratio of combined bbox diagonal
 * @param {number} [options.angleTolerance=0.26] - Max deviation to classify segment as orthogonal (radians, ~15°)
 * @param {number} [options.minVertexDistance=0.3] - Min distance between adjacent vertices (cleanup)
 * @param {number} [options.collinearThreshold=0.05] - Threshold for removing collinear vertices (radians, ~2.9°)
 * @param {number} [options.curveMinSegments=4] - Min consecutive short segments to detect a curve
 * @param {number} [options.maxDisplacementRatio=0.02] - Max vertex displacement as ratio of bbox diagonal (safety guard)
 * @param {number} [options.meterByPx=0] - Scale factor (meters per local pixel). When > 0, caps tolerance and displacement to physical wall thickness.
 * @returns {{ points: Array<{x: number, y: number}>, cuts: Array<{points: Array<{x: number, y: number}>, ...}>|undefined }}
 */
export default function alignPolygonsToGrid(mainPoints, cuts, options = {}) {
  const {
    referenceAngle = null,
    gridToleranceRatio = 0.006,
    angleTolerance = Math.PI / 12,
    minVertexDistance = 0.3,
    collinearThreshold = 0.05,
    curveMinSegments = 4,
    maxDisplacementRatio = 0.02,
    meterByPx = 0,
  } = options;

  // -- Input validation
  if (!mainPoints || mainPoints.length < 3) {
    return { points: mainPoints || [], cuts: cuts || undefined };
  }

  // Normalize points to {x, y}
  const norm = (p) =>
    Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y };

  const mainPts = mainPoints.map(norm);
  const cutPolygons = (cuts || []).map((cut) => ({
    ...cut,
    points: (cut.points || []).map(norm),
  }));

  // -- Step 1: determine reference angle (radians)
  let refRad;
  if (referenceAngle != null && referenceAngle !== 0) {
    refRad = (referenceAngle * Math.PI) / 180;
  } else {
    // Auto-detect from all segments combined
    const allSegments = [
      ...computeSegments(mainPts, true),
      ...cutPolygons.flatMap((c) =>
        c.points.length >= 3 ? computeSegments(c.points, true) : []
      ),
    ];
    refRad = findDominantAngle(allSegments);
  }

  // Normalize to [0, π/2) — orthogonal grids are 90°-periodic
  refRad = ((refRad % HALF_PI) + HALF_PI) % HALF_PI;

  // -- Step 2: rotate all points to axis-aligned space
  // The orthoSnapAngleOffset convention: walls are oriented AT the offset angle.
  // To align walls with axes, rotate points by +refRad (undo the offset).
  const allPolygons = [mainPts, ...cutPolygons.map((c) => c.points)];
  const rotated = allPolygons.map((pts) => rotatePoints(pts, refRad));

  // -- Step 3: classify segments per polygon (orthogonal vs diagonal vs curve)
  const classifications = rotated.map((pts) => {
    if (pts.length < 3) return { isOrthogonal: [], isCurved: [] };
    const segs = computeSegments(pts, true);
    const isCurved = detectCurvedSegments(segs, curveMinSegments);
    const isOrthogonal = segs.map((seg, i) => {
      if (isCurved[i]) return false;
      return isSegmentOrthogonal(seg.angle, angleTolerance);
    });
    return { isOrthogonal, isCurved };
  });

  // Build per-vertex snappable flag
  const snappable = rotated.map((pts, polyIdx) => {
    const { isOrthogonal } = classifications[polyIdx];
    return classifySnappableVertices(pts, isOrthogonal);
  });

  // -- Step 4: build shared grid from all snappable vertex coordinates
  const allRotatedFlat = [];
  for (const pts of rotated) {
    for (const p of pts) allRotatedFlat.push(p);
  }
  const bboxDiag = computeBBoxDiagonal(allRotatedFlat);

  // Grid tolerance: ratio-based, but capped to half a min wall thickness (7.5cm)
  // when meterByPx is known. This prevents snapping vertices across walls.
  const MIN_WALL_THICKNESS_M = 0.15;
  const halfWallPx = meterByPx > 0 ? (MIN_WALL_THICKNESS_M / 2) / meterByPx : Infinity;
  const gridTolerance = Math.min(bboxDiag * gridToleranceRatio, halfWallPx);

  const xValues = [];
  const yValues = [];
  for (let polyIdx = 0; polyIdx < rotated.length; polyIdx++) {
    const pts = rotated[polyIdx];
    const snap = snappable[polyIdx];
    for (let vi = 0; vi < pts.length; vi++) {
      if (snap[vi]) {
        xValues.push(pts[vi].x);
        yValues.push(pts[vi].y);
      }
    }
  }

  const gridX = clusterValues(xValues, gridTolerance);
  const gridY = clusterValues(yValues, gridTolerance);

  // If no meaningful grid, return with basic cleanup only
  if (gridX.length < 2 && gridY.length < 2) {
    return {
      points: cleanPolygon(mainPts, minVertexDistance, collinearThreshold),
      cuts: cutPolygons.length
        ? cutPolygons.map((c) => ({
            ...c,
            points: cleanPolygon(c.points, minVertexDistance, collinearThreshold),
          }))
        : undefined,
    };
  }

  // -- Step 5: snap vertices to grid (with max displacement guard)
  // Cap displacement to half wall thickness when scale is known
  const maxDisp = Math.min(bboxDiag * maxDisplacementRatio, halfWallPx);
  for (let polyIdx = 0; polyIdx < rotated.length; polyIdx++) {
    const pts = rotated[polyIdx];
    const snap = snappable[polyIdx];
    for (let vi = 0; vi < pts.length; vi++) {
      if (snap[vi]) {
        const snappedX = snapToGrid(pts[vi].x, gridX, gridTolerance);
        const snappedY = snapToGrid(pts[vi].y, gridY, gridTolerance);
        const dx = snappedX - pts[vi].x;
        const dy = snappedY - pts[vi].y;
        if (Math.sqrt(dx * dx + dy * dy) <= maxDisp) {
          pts[vi] = { x: snappedX, y: snappedY };
        }
      }
    }
  }

  // -- Step 5b: simplify small cut polygons (pillars) to clean shapes
  for (let polyIdx = 1; polyIdx < rotated.length; polyIdx++) {
    const { points: simplified, simplified: wasSimplified } = simplifyPillar(
      rotated[polyIdx],
      { meterByPx }
    );
    if (wasSimplified) {
      rotated[polyIdx] = simplified;
    }
  }

  // -- Step 6: rotate back (inverse of step 2)
  const result = rotated.map((pts) => rotatePoints(pts, -refRad));

  // -- Step 7: cleanup per polygon
  const cleanedMain = cleanPolygon(
    result[0],
    minVertexDistance,
    collinearThreshold
  );
  const cleanedCuts = cutPolygons.length
    ? cutPolygons.map((cut, i) => ({
        ...cut,
        points: cleanPolygon(
          result[i + 1],
          minVertexDistance,
          collinearThreshold
        ),
      }))
    : undefined;

  return { points: cleanedMain, cuts: cleanedCuts };
}

// ─── constants ──────────────────────────────────────────────────────

const TWO_PI = 2 * Math.PI;
const HALF_PI = Math.PI / 2;

// ─── vertex snappability classification ─────────────────────────────

/**
 * For each vertex, determine if it should be snapped to the grid.
 *
 * A vertex is snappable if at least one of its adjacent segments is
 * orthogonal (OR condition, not AND). This is needed to handle wall
 * endpoints: the short transverse segment at the end of a wall is
 * often slightly off-axis after OpenCV detection, but the wall itself
 * (the long segment) IS orthogonal. Without this, wall endpoints would
 * be excluded from grid snapping.
 *
 * Curved segments are safe: detectCurvedSegments already marks them as
 * non-orthogonal, so a vertex between two curved segments remains
 * non-snappable (false || false = false).
 */
function classifySnappableVertices(points, isOrthogonal) {
  const n = points.length;
  if (!isOrthogonal || !isOrthogonal.length) return new Array(n).fill(false);
  return points.map((_, vi) => {
    const segBefore = (vi - 1 + n) % n;
    const segAfter = vi % isOrthogonal.length;
    return isOrthogonal[segBefore] || isOrthogonal[segAfter];
  });
}

// ─── rotation ───────────────────────────────────────────────────────

function rotatePoints(points, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map((p) => ({
    x: cos * p.x - sin * p.y,
    y: sin * p.x + cos * p.y,
  }));
}

// ─── bbox ───────────────────────────────────────────────────────────

function computeBBoxDiagonal(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const dx = maxX - minX;
  const dy = maxY - minY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── segment computation ────────────────────────────────────────────

function computeSegments(points, closed) {
  const n = points.length;
  const count = closed ? n : n - 1;
  const segments = [];
  for (let i = 0; i < count; i++) {
    const from = i;
    const to = (i + 1) % n;
    const dx = points[to].x - points[from].x;
    const dy = points[to].y - points[from].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    segments.push({ from, to, dx, dy, len, angle });
  }
  return segments;
}

// ─── dominant angle detection ───────────────────────────────────────

/**
 * Find the primary dominant orientation using weighted circular mean
 * in the 90°-periodic domain.
 */
function findDominantAngle(segments) {
  if (segments.length === 0) return 0;

  let sumCos = 0;
  let sumSin = 0;
  let totalWeight = 0;
  for (const seg of segments) {
    if (seg.len < 1e-12) continue;
    const a4 = seg.angle * 4;
    sumCos += seg.len * Math.cos(a4);
    sumSin += seg.len * Math.sin(a4);
    totalWeight += seg.len;
  }
  if (totalWeight < 1e-12) return 0;

  let primary = Math.atan2(sumSin, sumCos) / 4;
  primary = ((primary % HALF_PI) + HALF_PI) % HALF_PI;
  return primary;
}

// ─── segment classification ─────────────────────────────────────────

/**
 * Check if a segment angle (in rotated/axis-aligned space) is near 0° or 90°.
 */
function isSegmentOrthogonal(angle, tolerance) {
  // Normalize angle to [0, 2π)
  let a = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
  // Check proximity to 0, π/2, π, 3π/2
  for (let k = 0; k < 4; k++) {
    const target = k * HALF_PI;
    let diff = Math.abs(a - target);
    if (diff > Math.PI) diff = TWO_PI - diff;
    if (diff <= tolerance) return true;
  }
  return false;
}

// ─── curve detection ────────────────────────────────────────────────

function detectCurvedSegments(segments, minSequenceLength) {
  const n = segments.length;
  if (n < minSequenceLength) return new Array(n).fill(false);

  const isCurved = new Array(n).fill(false);

  const sorted = segments.map((s) => s.len).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const shortThreshold = median * 0.5;

  let seqStart = -1;
  let prevTurnSign = 0;
  let consecutive = 0;

  const flush = (end) => {
    if (consecutive >= minSequenceLength && seqStart >= 0) {
      for (let j = seqStart; j < end; j++) isCurved[j] = true;
    }
    seqStart = -1;
    prevTurnSign = 0;
    consecutive = 0;
  };

  for (let i = 0; i < n; i++) {
    if (segments[i].len >= shortThreshold) {
      flush(i);
      continue;
    }

    if (seqStart < 0) {
      seqStart = i;
      consecutive = 1;
      prevTurnSign = 0;
      continue;
    }

    const turn = angleDiff(segments[i].angle, segments[i - 1].angle);
    const turnSign = Math.sign(turn);

    if (turnSign !== 0 && prevTurnSign !== 0 && turnSign !== prevTurnSign) {
      flush(i);
      seqStart = i;
      consecutive = 1;
      prevTurnSign = turnSign;
    } else {
      consecutive++;
      if (turnSign !== 0) prevTurnSign = turnSign;
    }
  }
  flush(n);

  return isCurved;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return d;
}

// ─── grid building ──────────────────────────────────────────────────

/**
 * Cluster nearby coordinate values and return sorted grid line positions.
 */
function clusterValues(values, tolerance) {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const clusters = [];
  let clusterStart = 0;

  for (let i = 1; i <= sorted.length; i++) {
    if (i === sorted.length || sorted[i] - sorted[i - 1] > tolerance) {
      let sum = 0;
      for (let j = clusterStart; j < i; j++) sum += sorted[j];
      clusters.push(sum / (i - clusterStart));
      clusterStart = i;
    }
  }

  return clusters;
}

/**
 * Snap a value to the nearest grid line within tolerance.
 */
function snapToGrid(value, grid, tolerance) {
  let bestDist = Infinity;
  let bestVal = value;
  for (const g of grid) {
    const dist = Math.abs(value - g);
    if (dist < bestDist) {
      bestDist = dist;
      bestVal = g;
    }
    if (g > value + tolerance) break;
  }
  return bestDist <= tolerance ? bestVal : value;
}

// ─── polygon cleanup ────────────────────────────────────────────────

function cleanPolygon(points, minDistance, collinearThreshold) {
  if (!points || points.length < 3) return points;

  let pts = removeCloseVertices(points, minDistance);
  pts = removeCollinearVertices(pts, true, collinearThreshold);
  return pts;
}

function removeCloseVertices(points, minDistance) {
  if (points.length < 4) return points;

  const filtered = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = filtered[filtered.length - 1];
    const dx = points[i].x - prev.x;
    const dy = points[i].y - prev.y;
    if (Math.sqrt(dx * dx + dy * dy) >= minDistance) {
      filtered.push(points[i]);
    }
  }
  // Check wrap-around
  if (filtered.length > 3) {
    const last = filtered[filtered.length - 1];
    const first = filtered[0];
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    if (Math.sqrt(dx * dx + dy * dy) < minDistance) {
      filtered.pop();
    }
  }

  return filtered.length >= 3 ? filtered : points;
}

function removeCollinearVertices(points, closed, threshold = 0.01) {
  if (points.length < 4) return points;

  const n = points.length;
  const keep = new Array(n).fill(true);

  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) continue;

    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;

    const dx1 = points[i].x - points[prev].x;
    const dy1 = points[i].y - points[prev].y;
    const dx2 = points[next].x - points[i].x;
    const dy2 = points[next].y - points[i].y;

    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (len1 < 1e-12 || len2 < 1e-12) {
      keep[i] = false;
      continue;
    }

    const cross = Math.abs(dx1 * dy2 - dy1 * dx2) / (len1 * len2);
    if (cross < threshold) {
      keep[i] = false;
    }
  }

  const result = points.filter((_, i) => keep[i]);
  return result.length >= 3 ? result : points;
}
