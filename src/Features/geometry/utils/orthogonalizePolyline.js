/**
 * Orthogonalize a polyline by snapping segments to dominant orthogonal axes.
 *
 * Building floor plans typically have walls meeting at right angles. This
 * function detects the dominant wall orientations and snaps nearby segments
 * to clean 90° angles, while preserving intentionally curved sections
 * (e.g. parking ramps) and supporting multiple orientation groups
 * (e.g. main building + rotated wing).
 *
 * Should be applied after point simplification (approxPolyDP / cleanPolylinePoints).
 *
 * @param {Array<{x: number, y: number}>} points - Input polyline points
 * @param {Object} [options]
 * @param {number} [options.angleTolerance=0.26] - Max angle deviation to snap (radians, ~15°)
 * @param {number} [options.curveMinSegments=4] - Min consecutive short segments to detect a curve
 * @param {boolean} [options.closedPolygon=true] - Whether the polyline forms a closed polygon
 * @param {number} [options.maxOrientationGroups=2] - Max dominant orientation groups to detect
 * @param {number} [options.maxDisplacementRatio=0.05] - Max vertex displacement as ratio of bbox diagonal
 * @param {number} [options.minFeatureSizeRatio=0.02] - Small features (pillars) below this ratio of bbox diagonal are removed
 * @returns {Array<{x: number, y: number}>}
 */
export default function orthogonalizePolyline(points, options = {}) {
  const {
    angleTolerance = Math.PI / 12, // 15°
    curveMinSegments = 4,
    closedPolygon = true,
    maxOrientationGroups = 2,
    maxDisplacementRatio = 0.05,
    minFeatureSizeRatio = 0.02,
  } = options;

  if (!points || points.length < 4) return points;

  let pts = points.map((p) =>
    Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y }
  );

  const bboxDiag = computeBBoxDiagonal(pts);

  const minFeatureSize = bboxDiag * minFeatureSizeRatio;
  // Step 0: pre-simplify — remove small bumps (pillars, columns) before snapping
  // pts = simplifySmallFeatures(pts, closedPolygon, minFeatureSize);
  // if (pts.length < 4) return pts;

  // Step 1: compute segments and find dominant orientations
  const segments = computeSegments(pts, closedPolygon);
  if (segments.length < 3) return pts;

  const dominantAngles = findDominantAngles(
    segments,
    maxOrientationGroups,
    angleTolerance
  );

  // Step 2: detect curves (arcs, ramps) to preserve them
  const isCurved = detectCurvedSegments(segments, curveMinSegments);

  // Step 3: snap each non-curved segment to nearest dominant axis
  const snappedAngles = segments.map((seg, i) => {
    if (isCurved[i]) return seg.angle;
    return findBestSnap(seg.angle, dominantAngles, angleTolerance);
  });

  // Step 4: reconstruct vertices via line intersection
  const maxDisp = bboxDiag * maxDisplacementRatio;
  let result = reconstructVertices(
    pts,
    segments,
    snappedAngles,
    closedPolygon,
    maxDisp
  );

  // Step 5: remove collinear vertices created by snapping
  result = removeCollinearVertices(result, closedPolygon);

  // Step 6: remove small rectangular jogs (residual pillar notches after snapping)
  // result = removeSmallJogs(result, closedPolygon, minFeatureSize);

  // Step 7: final collinear cleanup after jog removal
  // return removeCollinearVertices(result, closedPolygon);

  return result;
}

// ─── constants ──────────────────────────────────────────────────────

const TWO_PI = 2 * Math.PI;
const HALF_PI = Math.PI / 2;

// ─── angle helpers ──────────────────────────────────────────────────

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return d;
}

function deviationFromOrthogonalGrid(angle, base) {
  let bestDev = Infinity;
  let bestCandidate = base;
  for (let k = 0; k < 4; k++) {
    const candidate = base + k * HALF_PI;
    const dev = Math.abs(angleDiff(angle, candidate));
    if (dev < bestDev) {
      bestDev = dev;
      bestCandidate = candidate;
    }
  }
  return { deviation: bestDev, snappedAngle: bestCandidate };
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
 * Find 1-N dominant orientation groups using weighted circular mean
 * in the 90°-periodic domain (building walls repeat every 90°).
 */
function findDominantAngles(segments, maxGroups, groupingThreshold) {
  if (segments.length === 0) return [0];

  // Weighted circular mean: map angle×4 so 90° period → full circle
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
  if (totalWeight < 1e-12) return [0];

  let primary = Math.atan2(sumSin, sumCos) / 4;
  primary = ((primary % HALF_PI) + HALF_PI) % HALF_PI;
  const result = [primary];

  if (maxGroups <= 1) return result;

  // Collect segments that don't fit the primary grid
  const outliers = [];
  let outlierWeight = 0;
  for (const seg of segments) {
    if (seg.len < 1e-12) continue;
    const { deviation } = deviationFromOrthogonalGrid(seg.angle, primary);
    if (deviation > groupingThreshold) {
      outliers.push(seg);
      outlierWeight += seg.len;
    }
  }

  if (outliers.length >= 3 && outlierWeight > totalWeight * 0.1) {
    let sc = 0;
    let ss = 0;
    for (const seg of outliers) {
      const a4 = seg.angle * 4;
      sc += seg.len * Math.cos(a4);
      ss += seg.len * Math.sin(a4);
    }
    let secondary = Math.atan2(ss, sc) / 4;
    secondary = ((secondary % HALF_PI) + HALF_PI) % HALF_PI;

    const diff = Math.abs(angleDiff(primary * 4, secondary * 4)) / 4;
    if (diff > groupingThreshold) {
      result.push(secondary);
    }
  }

  return result;
}

// ─── curve detection ────────────────────────────────────────────────

/**
 * Detect sequences of short segments with consistent curvature
 * (all turning the same direction). These represent arcs / curved walls
 * and should NOT be orthogonalized.
 */
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

// ─── snapping ───────────────────────────────────────────────────────

function findBestSnap(segAngle, dominantAngles, tolerance) {
  let bestAngle = segAngle;
  let bestDev = Infinity;
  for (const base of dominantAngles) {
    const { deviation, snappedAngle } = deviationFromOrthogonalGrid(
      segAngle,
      base
    );
    if (deviation < bestDev) {
      bestDev = deviation;
      bestAngle = snappedAngle;
    }
  }
  return bestDev <= tolerance ? bestAngle : segAngle;
}

// ─── line intersection ──────────────────────────────────────────────

function intersectLines(p1, θ1, p2, θ2) {
  const c1 = Math.cos(θ1);
  const s1 = Math.sin(θ1);
  const c2 = Math.cos(θ2);
  const s2 = Math.sin(θ2);
  const det = c1 * s2 - s1 * c2;
  if (Math.abs(det) < 1e-10) return null;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * s2 - dy * c2) / det;

  return { x: p1.x + t * c1, y: p1.y + t * s1 };
}

// ─── vertex reconstruction ──────────────────────────────────────────

/**
 * Recompute vertex positions by intersecting the lines of consecutive
 * snapped segments. Each segment line passes through the midpoint of its
 * original endpoints, which keeps the result close to the input shape.
 */
function reconstructVertices(points, segments, snappedAngles, closed, maxDisp) {
  const n = points.length;
  const segCount = segments.length;
  const newPoints = points.map((p) => ({ x: p.x, y: p.y }));

  const segMidpoints = segments.map((seg) => ({
    x: (points[seg.from].x + points[seg.to].x) / 2,
    y: (points[seg.from].y + points[seg.to].y) / 2,
  }));

  const start = closed ? 0 : 1;
  const end = closed ? n : n - 1;

  for (let i = start; i < end; i++) {
    const segBefore = closed
      ? (i - 1 + segCount) % segCount
      : i - 1;
    const segAfter = closed ? i % segCount : i;

    const intersection = intersectLines(
      segMidpoints[segBefore],
      snappedAngles[segBefore],
      segMidpoints[segAfter],
      snappedAngles[segAfter]
    );
    if (!intersection) continue;

    const dx = intersection.x - points[i].x;
    const dy = intersection.y - points[i].y;
    if (Math.sqrt(dx * dx + dy * dy) <= maxDisp) {
      newPoints[i] = intersection;
    }
  }

  return newPoints;
}

// ─── collinear cleanup ──────────────────────────────────────────────

/**
 * Remove vertices that became collinear after snapping
 * (two consecutive segments pointing in the same direction).
 */
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

  return points.filter((_, i) => keep[i]);
}

// ─── pre-simplification (pillar bump removal) ──────────────────────

/**
 * Remove vertices whose perpendicular distance to the line between their
 * neighbors is below minSize. This eliminates small bumps caused by pillars
 * or columns before the orthogonalization step.
 * Uses an iterative smallest-first approach (Visvalingam-Whyatt style).
 */
function simplifySmallFeatures(points, closed, minSize) {
  if (points.length < 5) return points;

  let pts = points.map((p) => ({ x: p.x, y: p.y }));
  let changed = true;

  while (changed && pts.length >= 4) {
    changed = false;
    const n = pts.length;
    let minDist = Infinity;
    let minIdx = -1;

    for (let i = 0; i < n; i++) {
      if (!closed && (i === 0 || i === n - 1)) continue;

      const prev = (i - 1 + n) % n;
      const next = (i + 1) % n;
      const dist = pointToLineDistance(pts[i], pts[prev], pts[next]);

      if (dist < minDist) {
        minDist = dist;
        minIdx = i;
      }
    }

    if (minDist < minSize && minIdx >= 0) {
      pts.splice(minIdx, 1);
      changed = true;
    }
  }

  return pts;
}

function pointToLineDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-12) {
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  return Math.abs(dx * (a.y - p.y) - dy * (a.x - p.x)) / len;
}

// ─── post-orthogonalization jog removal ─────────────────────────────

/**
 * Remove small rectangular jogs from an orthogonalized polygon.
 * A jog is a sequence of 3 short segments where the first and third are
 * roughly anti-parallel (the contour goes out around a pillar then comes back).
 * Removing the 2 inner vertices flattens the notch.
 */
function removeSmallJogs(points, closed, minJogSize) {
  if (!closed || points.length < 6) return points;

  let pts = points.map((p) => ({ x: p.x, y: p.y }));
  let changed = true;
  let maxIter = 20;

  while (changed && maxIter-- > 0 && pts.length >= 6) {
    changed = false;
    const n = pts.length;
    const segs = computeSegments(pts, true);

    // Find the smallest jog (3 consecutive short segments, anti-parallel outer pair)
    let bestIdx = -1;
    let bestArea = Infinity;

    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      const i2 = (i + 2) % n;

      if (segs[i].len >= minJogSize && segs[i1].len >= minJogSize && segs[i2].len >= minJogSize) continue;

      // At least 2 of the 3 segments must be short
      const shortCount =
        (segs[i].len < minJogSize ? 1 : 0) +
        (segs[i1].len < minJogSize ? 1 : 0) +
        (segs[i2].len < minJogSize ? 1 : 0);
      if (shortCount < 2) continue;

      // The outer pair must be roughly anti-parallel (going out, coming back)
      const diff = Math.abs(angleDiff(segs[i].angle, segs[i2].angle));
      if (Math.abs(diff - Math.PI) > 0.5) continue;

      const area = segs[i].len * segs[i1].len;
      if (area < bestArea) {
        bestArea = area;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const v1 = (bestIdx + 1) % pts.length;
      const v2 = (bestIdx + 2) % pts.length;
      const toRemove = new Set([v1, v2]);
      pts = pts.filter((_, idx) => !toRemove.has(idx));
      changed = true;
    }
  }

  return pts;
}

// ─── bbox helper ────────────────────────────────────────────────────

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
