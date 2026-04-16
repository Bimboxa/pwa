/**
 * Detect similar strips in 3 independent steps:
 *   1. Colinear   — extend along the source strip's main axis
 *   2. Transverse — find parallel walls in the normal direction
 *   3. Squares    — extend "square" segments in the perpendicular direction
 *
 * All coordinates are in **source-image pixel** space.
 */

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function getBrightness(imageData, x, y) {
  const idx = (y * imageData.width + x) * 4;
  return (
    imageData.data[idx] * 0.299 +
    imageData.data[idx + 1] * 0.587 +
    imageData.data[idx + 2] * 0.114
  );
}

/** Normalised normal vector (perpendicular to centerline, rotated 90° CCW). */
export function computeNormal(centerlinePoints) {
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < centerlinePoints.length - 1; i++) {
    dx += centerlinePoints[i + 1].x - centerlinePoints[i].x;
    dy += centerlinePoints[i + 1].y - centerlinePoints[i].y;
  }
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { dx: -dy / len, dy: dx / len };
}

/**
 * Cast a ray from `origin` in ±dir and detect dark bands.
 * Returns { center, width } where center = signed offset from origin.
 */
function scanRay(imageData, origin, dir, maxDist, darknessThreshold, viewportBBox, exclusionMask) {
  const bands = [];
  for (const sign of [1, -1]) {
    let inBand = false;
    let bandStart = 0;
    for (let d = 0; d <= maxDist; d++) {
      const px = Math.round(origin.x + sign * d * dir.dx);
      const py = Math.round(origin.y + sign * d * dir.dy);
      if (px < 0 || py < 0 || px >= imageData.width || py >= imageData.height) {
        if (inBand) { bands.push({ center: sign * ((bandStart + d - 1) / 2), width: d - bandStart }); inBand = false; }
        break;
      }
      if (px < viewportBBox.x || py < viewportBBox.y || px >= viewportBBox.x + viewportBBox.width || py >= viewportBBox.y + viewportBBox.height) {
        if (inBand) { bands.push({ center: sign * ((bandStart + d - 1) / 2), width: d - bandStart }); inBand = false; }
        break;
      }
      const isExcluded = exclusionMask && exclusionMask[py * imageData.width + px];
      const bright = isExcluded ? 255 : getBrightness(imageData, px, py);
      if (bright < darknessThreshold) {
        if (!inBand) { bandStart = d; inBand = true; }
      } else {
        if (inBand) { bands.push({ center: sign * ((bandStart + d - 1) / 2), width: d - bandStart }); inBand = false; }
      }
    }
    if (inBand) { bands.push({ center: sign * ((bandStart + maxDist) / 2), width: maxDist - bandStart + 1 }); }
  }
  return bands;
}

/**
 * Check if a dark band of matching width exists at a given point,
 * by counting dark-pixel density across the expected strip width.
 *
 * `symmetric`: probe both sides [-halfW, +halfW] instead of one side.
 */
function probeWidthAt(
  imageData, point, probeDir, stripWidthPx, stripOrientation,
  minWidth, maxWidth, darknessThreshold, exclusionMask,
  densityThreshold = 0.55, symmetric = false
) {
  const halfW = Math.round(stripWidthPx / 2);
  const sampleStart = symmetric ? -halfW : Math.round(stripOrientation > 0 ? 0 : -stripWidthPx);
  const sampleEnd = symmetric ? halfW : Math.round(stripOrientation > 0 ? stripWidthPx : 0);
  let darkCount = 0;
  let totalCount = 0;

  for (let d = sampleStart; d <= sampleEnd; d++) {
    const px = Math.round(point.x + d * probeDir.dx);
    const py = Math.round(point.y + d * probeDir.dy);
    if (px < 0 || py < 0 || px >= imageData.width || py >= imageData.height) continue;
    const isExcluded = exclusionMask && exclusionMask[py * imageData.width + px];
    if (isExcluded) continue;
    totalCount++;
    if (getBrightness(imageData, px, py) < darknessThreshold) darkCount++;
  }

  if (totalCount === 0) return false;
  return darkCount / totalCount >= densityThreshold;
}

/**
 * Scan along `scanDir` from `refPoint`, probing for wall presence with
 * `probeDir`. Returns an array of segments { start, end }.
 * Gap bridging: < 5px = noise (bridge), ≥ 5px = real separation.
 */
function extractSegments({
  imageData, exclusionMask, viewportBBox,
  probeDir, scanDir, refPoint,
  stripWidthPx, stripOrientation,
  darknessThreshold, minWidth, maxWidth,
  stepPx = 2, minSegmentLengthPx = 10, maxGapPx = 5,
  symmetric = false, densityThreshold = 0.55,
}) {
  const maxDist = Math.ceil(
    Math.sqrt(viewportBBox.width ** 2 + viewportBBox.height ** 2)
  );

  const hits = [];
  for (const sign of [1, -1]) {
    for (let d = 0; d <= maxDist; d += stepPx) {
      const px = refPoint.x + sign * d * scanDir.dx;
      const py = refPoint.y + sign * d * scanDir.dy;
      const rx = Math.round(px);
      const ry = Math.round(py);
      if (rx < viewportBBox.x || ry < viewportBBox.y ||
          rx >= viewportBBox.x + viewportBBox.width ||
          ry >= viewportBBox.y + viewportBBox.height) break;

      if (probeWidthAt(imageData, { x: px, y: py }, probeDir,
          stripWidthPx, stripOrientation, minWidth, maxWidth,
          darknessThreshold, exclusionMask, densityThreshold, symmetric)) {
        hits.push({ d: sign * d, x: px, y: py });
      }
    }
  }

  if (hits.length === 0) return [];
  hits.sort((a, b) => a.d - b.d);

  const segments = [];
  let segStart = hits[0];
  let segEnd = hits[0];
  for (let i = 1; i < hits.length; i++) {
    if (hits[i].d - segEnd.d <= maxGapPx + stepPx) {
      segEnd = hits[i];
    } else {
      if (segEnd.d - segStart.d >= minSegmentLengthPx)
        segments.push({ start: { x: segStart.x, y: segStart.y }, end: { x: segEnd.x, y: segEnd.y } });
      segStart = hits[i];
      segEnd = hits[i];
    }
  }
  if (segEnd.d - segStart.d >= minSegmentLengthPx)
    segments.push({ start: { x: segStart.x, y: segStart.y }, end: { x: segEnd.x, y: segEnd.y } });

  return segments;
}

function segLength(seg) {
  return Math.sqrt((seg.end.x - seg.start.x) ** 2 + (seg.end.y - seg.start.y) ** 2);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

/**
 * @param {Object} p
 * @param {ImageData} p.imageData
 * @param {Array<{x,y}>} p.centerlinePoints   Source strip centerline (image px)
 * @param {number} p.stripWidthPx
 * @param {{x,y,width,height}} p.viewportBBox
 * @param {number} [p.stripOrientation=1]
 * @param {number} [p.darknessThreshold=128]
 * @param {number} [p.widthTolerance=0.30]
 * @param {Uint8Array} [p.exclusionMask]
 * @param {boolean} [p.detectColinear=true]
 * @param {boolean} [p.detectTransverse=true]
 * @param {boolean} [p.detectSquares=true]
 * @returns {Array<{segments: Array<{start:{x,y}, end:{x,y}}>}>}
 */
export default function detectSimilarStrips({
  imageData,
  centerlinePoints,
  stripWidthPx,
  viewportBBox,
  stripOrientation = 1,
  darknessThreshold = 128,
  widthTolerance = 0.30,
  exclusionMask,
  detectColinear = true,
  detectTransverse = true,
  detectSquares = true,
}) {
  if (!imageData || !centerlinePoints || centerlinePoints.length < 2) return [];

  const normal = computeNormal(centerlinePoints);
  const tangent = { dx: normal.dy, dy: -normal.dx };
  const mid = {
    x: (centerlinePoints[0].x + centerlinePoints[centerlinePoints.length - 1].x) / 2,
    y: (centerlinePoints[0].y + centerlinePoints[centerlinePoints.length - 1].y) / 2,
  };
  const minWidth = stripWidthPx * (1 - widthTolerance);
  const maxWidth = stripWidthPx * (1 + widthTolerance);
  const maxDist = Math.ceil(Math.sqrt(viewportBBox.width ** 2 + viewportBBox.height ** 2));

  // Source strip extent along tangent (for overlap exclusion)
  const srcD0 = (centerlinePoints[0].x - mid.x) * tangent.dx + (centerlinePoints[0].y - mid.y) * tangent.dy;
  const srcD1 = (centerlinePoints[centerlinePoints.length - 1].x - mid.x) * tangent.dx + (centerlinePoints[centerlinePoints.length - 1].y - mid.y) * tangent.dy;
  const srcDMin = Math.min(srcD0, srcD1);
  const srcDMax = Math.max(srcD0, srcD1);

  const baseParams = {
    imageData, exclusionMask, viewportBBox,
    stripWidthPx, stripOrientation, darknessThreshold,
    minWidth, maxWidth,
  };

  const allSegments = []; // collect all detected segments

  // =========================================================================
  // Step 1 — Colinear: extend along the main axis of the source strip
  // =========================================================================
  if (detectColinear) {
    const segs = extractSegments({
      ...baseParams,
      probeDir: normal,
      scanDir: tangent,
      refPoint: mid,
    });

    // Exclude segments that overlap with the source strip
    for (const seg of segs) {
      const d0 = (seg.start.x - mid.x) * tangent.dx + (seg.start.y - mid.y) * tangent.dy;
      const d1 = (seg.end.x - mid.x) * tangent.dx + (seg.end.y - mid.y) * tangent.dy;
      const segMin = Math.min(d0, d1);
      const segMax = Math.max(d0, d1);
      const overlap = Math.max(0, Math.min(srcDMax, segMax) - Math.max(srcDMin, segMin));
      const len = segMax - segMin;
      if (len > 0 && overlap / len < 0.5) {
        allSegments.push(seg);
      }
    }
  }

  // =========================================================================
  // Step 2 — Transverse: find parallel walls in the normal direction
  // =========================================================================
  if (detectTransverse) {
    // Single ray from midpoint in normal direction → find all matching bands
    const bands = scanRay(imageData, mid, normal, maxDist, darknessThreshold, viewportBBox, exclusionMask);
    const offsets = bands
      .filter((b) => b.width >= minWidth && b.width <= maxWidth)
      .filter((b) => Math.abs(b.center) > stripWidthPx * 0.5) // skip source
      .map((b) => b.center - stripOrientation * b.width / 2);

    for (const offset of offsets) {
      const refPoint = {
        x: mid.x + offset * normal.dx,
        y: mid.y + offset * normal.dy,
      };
      const segs = extractSegments({
        ...baseParams,
        probeDir: normal,
        scanDir: tangent,
        refPoint,
      });
      allSegments.push(...segs);
    }
  }

  // =========================================================================
  // Step 3 — Squares: extend square-ish segments in the perpendicular dir
  // =========================================================================
  if (detectSquares) {
    const finalSegments = [];
    for (const seg of allSegments) {
      const len = segLength(seg);
      if (Math.abs(len - stripWidthPx) <= 2) {
        // Square segment — try extending in the normal direction
        // Shift to wall center (the centerline is on the edge, shift by
        // half-width in the tangent direction to reach the wall center)
        const segMid = {
          x: (seg.start.x + seg.end.x) / 2 + stripOrientation * (stripWidthPx / 2) * tangent.dx,
          y: (seg.start.y + seg.end.y) / 2 + stripOrientation * (stripWidthPx / 2) * tangent.dy,
        };
        const extSegs = extractSegments({
          ...baseParams,
          probeDir: tangent,   // probe in tangent direction (perpendicular to extension)
          scanDir: normal,     // extend in normal direction
          refPoint: segMid,
          symmetric: true,
          densityThreshold: 0.70,
        });
        const best = extSegs.length > 0
          ? extSegs.reduce((a, b) => segLength(a) > segLength(b) ? a : b)
          : null;
        if (best && segLength(best) > len) {
          // Shift back from wall center to wall edge
          const shiftX = -stripOrientation * (stripWidthPx / 2) * tangent.dx;
          const shiftY = -stripOrientation * (stripWidthPx / 2) * tangent.dy;
          finalSegments.push({
            start: { x: best.start.x + shiftX, y: best.start.y + shiftY },
            end: { x: best.end.x + shiftX, y: best.end.y + shiftY },
          });
        } else {
          finalSegments.push(seg);
        }
      } else {
        finalSegments.push(seg);
      }
    }
    // Replace allSegments with processed ones
    allSegments.length = 0;
    allSegments.push(...finalSegments);
  }

  // =========================================================================
  // Deduplicate: merge segments whose midpoints are within 2px
  // =========================================================================
  const deduped = [];
  const used = new Array(allSegments.length).fill(false);
  for (let i = 0; i < allSegments.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const a = allSegments[i];
    const aMid = { x: (a.start.x + a.end.x) / 2, y: (a.start.y + a.end.y) / 2 };
    let best = a;
    let bestLen = segLength(a);
    for (let j = i + 1; j < allSegments.length; j++) {
      if (used[j]) continue;
      const b = allSegments[j];
      const bMid = { x: (b.start.x + b.end.x) / 2, y: (b.start.y + b.end.y) / 2 };
      const dist = Math.sqrt((aMid.x - bMid.x) ** 2 + (aMid.y - bMid.y) ** 2);
      if (dist < 2) {
        used[j] = true;
        const bLen = segLength(b);
        if (bLen > bestLen) { best = b; bestLen = bLen; }
      }
    }
    deduped.push(best);
  }

  // Return in the expected format
  if (deduped.length === 0) return [];
  return [{ segments: deduped }];
}
