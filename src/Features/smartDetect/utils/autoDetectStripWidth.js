/**
 * Auto-detect wall thickness, per segment, for STRIP / SEGMENT detection.
 *
 * Strategy (caller-driven):
 *   1. Run `detectStripFromLoupe` once for each candidate width in
 *      DEFAULT_WALL_CANDIDATES_CM, in median-axis mode.
 *   2. For each returned segment, score it at its candidate width using
 *      `scoreSegmentAtWidth` — the score peaks at the actual wall width
 *      because narrower bands miss dark pixels at the wall edges and wider
 *      bands dilute the density with white background.
 *   3. Dedupe overlapping segments via `dedupeSegmentsKeepBestScore`.
 *   4. The caller then re-applies the STRIP edge-shift per segment using
 *      the selected width, and commits each strip with its own strokeWidth.
 *
 * All coordinates are in **source-image pixel** space.
 */

import { getBrightness } from "./stripDetectionHelpers";

// Standard French masonry wall thicknesses. Kept as a named export so the
// UI could expose it as a setting later without chasing the constant.
export const DEFAULT_WALL_CANDIDATES_CM = [10, 15, 20, 25, 30];

/**
 * Count `dark − light` pixels inside a band of `widthPx` centred on the
 * segment's median axis, sampled at 1 px intervals along tangent and
 * normal. Peaks at the actual wall width.
 *
 * @param {Object} p
 * @param {{start:{x,y}, end:{x,y}}} p.segment
 * @param {number} p.widthPx
 * @param {ImageData} p.imageData
 * @param {{dx,dy}} p.normal
 * @param {Uint8Array} [p.exclusionMask]
 * @param {number} [p.darknessThreshold=128]
 * @returns {number}
 */
export function scoreSegmentAtWidth({
  segment,
  widthPx,
  imageData,
  normal,
  exclusionMask,
  darknessThreshold = 128,
}) {
  const iw = imageData.width;
  const ih = imageData.height;
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const segLen = Math.sqrt(dx * dx + dy * dy);
  if (segLen <= 0) return -Infinity;
  const steps = Math.max(1, Math.round(segLen));
  const halfW = Math.ceil(widthPx / 2);

  let dark = 0;
  let light = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bx = segment.start.x + t * dx;
    const by = segment.start.y + t * dy;
    for (let w = -halfW; w <= halfW; w++) {
      const px = Math.round(bx + w * normal.dx);
      const py = Math.round(by + w * normal.dy);
      if (px < 0 || py < 0 || px >= iw || py >= ih) continue;
      if (exclusionMask && exclusionMask[py * iw + px]) continue;
      if (getBrightness(imageData, px, py) < darknessThreshold) dark++;
      else light++;
    }
  }
  return dark - light;
}

/**
 * Dedupe segments detected at different candidate widths: group those whose
 * midpoints are within `max(widthPx_a, widthPx_b)` of each other, keep the
 * one with the best score per group.
 *
 * Simple O(N²) by pairwise midpoint distance — N is at most ~5 × (walls in
 * loupe), typically single digits.
 *
 * @param {Array<{seg:{start,end}, widthCm:number, widthPx:number, score:number}>} detections
 * @returns {Array} kept detections (highest-scoring first).
 */
export function dedupeSegmentsKeepBestScore(detections) {
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const kept = [];
  for (const d of sorted) {
    const dMid = midOf(d.seg);
    const isDup = kept.some((k) => {
      const kMid = midOf(k.seg);
      const threshold = Math.max(k.widthPx, d.widthPx);
      return Math.hypot(dMid.x - kMid.x, dMid.y - kMid.y) < threshold;
    });
    if (!isDup) kept.push(d);
  }
  return kept;
}

function midOf(seg) {
  return {
    x: (seg.start.x + seg.end.x) / 2,
    y: (seg.start.y + seg.end.y) / 2,
  };
}
