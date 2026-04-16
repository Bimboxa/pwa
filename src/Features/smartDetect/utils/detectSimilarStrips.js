/**
 * Detect similar strips in 3 independent steps:
 *   1. Colinear   — extend along the source strip's main axis
 *   2. Transverse — find parallel walls in the normal direction
 *   3. Squares    — extend "square" segments in the perpendicular direction
 *
 * All coordinates are in **source-image pixel** space.
 *
 * Helpers (scanRay, probeWidthAt, extractSegments, etc.) live in
 * `stripDetectionHelpers.js` so they can be reused by detectStripFromLoupe.
 */

import {
  computeNormal,
  scanRay,
  extractSegments,
  segLength,
  deduplicateSegments,
} from "./stripDetectionHelpers";

// Re-export computeNormal for backward compat (used by IconButton in some places)
export { computeNormal };

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
  const deduped = deduplicateSegments(allSegments);

  // Return in the expected format
  if (deduped.length === 0) return [];
  return [{ segments: deduped }];
}
