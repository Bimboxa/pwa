/**
 * Shared helpers for strip detection algorithms.
 * Used by both detectSimilarStrips (toolbar button) and
 * detectStripFromLoupe (drawing tool).
 *
 * All coordinates are in **source-image pixel** space.
 */

export function getBrightness(imageData, x, y) {
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
export function scanRay(imageData, origin, dir, maxDist, darknessThreshold, viewportBBox, exclusionMask) {
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
export function probeWidthAt(
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
export function extractSegments({
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
      // Compare floats against the (potentially fractional) viewportBBox —
      // rounding only belongs in the pixel-index lookup below, not in the
      // geometric bounds check. A float-vs-float test is what the bbox
      // semantics require.
      if (px < viewportBBox.x || py < viewportBBox.y ||
          px >= viewportBBox.x + viewportBBox.width ||
          py >= viewportBBox.y + viewportBBox.height) break;

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

export function segLength(seg) {
  return Math.sqrt((seg.end.x - seg.start.x) ** 2 + (seg.end.y - seg.start.y) ** 2);
}

/**
 * Deduplicate segments: merge segments whose midpoints are within 2 pixels.
 * Keeps the longer segment from each cluster.
 */
export function deduplicateSegments(segments) {
  if (!segments?.length) return [];
  const used = new Array(segments.length).fill(false);
  const deduped = [];
  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const a = segments[i];
    const aMid = { x: (a.start.x + a.end.x) / 2, y: (a.start.y + a.end.y) / 2 };
    let best = a;
    let bestLen = segLength(a);
    for (let j = i + 1; j < segments.length; j++) {
      if (used[j]) continue;
      const b = segments[j];
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
  return deduped;
}
