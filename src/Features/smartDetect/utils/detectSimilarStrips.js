/**
 * Detect similar strips by scanning 1D brightness profiles along the strip's
 * normal direction.  For each profile ray we find dark bands whose width
 * matches the reference strip, then cross-validate across multiple rays to
 * reject noise.
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

/** Compute a normalised normal vector for the strip's centerline. */
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
 * Pick N evenly-spaced anchor points **along** the centerline polyline,
 * interpolating between vertices. Avoids the endpoints (uses the 15%-85%
 * range) to dodge noise at wall junctions.
 */
function sampleAnchors(centerlinePoints, count) {
  // Compute cumulative arc-length
  const cumLen = [0];
  for (let i = 1; i < centerlinePoints.length; i++) {
    const dx = centerlinePoints[i].x - centerlinePoints[i - 1].x;
    const dy = centerlinePoints[i].y - centerlinePoints[i - 1].y;
    cumLen.push(cumLen[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const totalLen = cumLen[cumLen.length - 1];
  if (totalLen === 0) return [centerlinePoints[0]];

  // Sample between 15% and 85% of the total length
  const MARGIN = 0.15;
  const startT = MARGIN;
  const endT = 1 - MARGIN;
  const step = count > 1 ? (endT - startT) / (count - 1) : 0;

  const anchors = [];
  for (let i = 0; i < count; i++) {
    const t = startT + i * step;
    const targetLen = t * totalLen;

    // Find the segment containing this length
    let segIdx = 0;
    for (let j = 1; j < cumLen.length; j++) {
      if (cumLen[j] >= targetLen) { segIdx = j - 1; break; }
    }

    const segLen = cumLen[segIdx + 1] - cumLen[segIdx];
    const localT = segLen > 0 ? (targetLen - cumLen[segIdx]) / segLen : 0;
    const p0 = centerlinePoints[segIdx];
    const p1 = centerlinePoints[segIdx + 1];
    anchors.push({
      x: p0.x + (p1.x - p0.x) * localT,
      y: p0.y + (p1.y - p0.y) * localT,
    });
  }

  return anchors;
}

/**
 * Cast a ray from `origin` in direction `dir` and detect dark bands.
 * Returns an array of { center, width } where center is the signed offset
 * from origin along dir.
 */
function scanRay(
  imageData,
  origin,
  dir,
  maxDist,
  darknessThreshold,
  viewportBBox,
  exclusionMask
) {
  const bands = [];

  for (const sign of [1, -1]) {
    let inBand = false;
    let bandStart = 0;

    for (let d = 0; d <= maxDist; d++) {
      const px = Math.round(origin.x + sign * d * dir.dx);
      const py = Math.round(origin.y + sign * d * dir.dy);

      // Out of image bounds?
      if (
        px < 0 || py < 0 ||
        px >= imageData.width || py >= imageData.height
      ) {
        if (inBand) {
          bands.push({
            center: sign * ((bandStart + d - 1) / 2),
            width: d - bandStart,
          });
          inBand = false;
        }
        break;
      }

      // Out of viewport? (stop scanning this direction)
      if (
        px < viewportBBox.x ||
        py < viewportBBox.y ||
        px >= viewportBBox.x + viewportBBox.width ||
        py >= viewportBBox.y + viewportBBox.height
      ) {
        if (inBand) {
          bands.push({
            center: sign * ((bandStart + d - 1) / 2),
            width: d - bandStart,
          });
          inBand = false;
        }
        break;
      }

      // Excluded pixel (existing annotation) → treat as white
      const isExcluded = exclusionMask && exclusionMask[py * imageData.width + px];

      const bright = isExcluded ? 255 : getBrightness(imageData, px, py);

      if (bright < darknessThreshold) {
        if (!inBand) {
          bandStart = d;
          inBand = true;
        }
      } else {
        if (inBand) {
          bands.push({
            center: sign * ((bandStart + d - 1) / 2),
            width: d - bandStart,
          });
          inBand = false;
        }
      }
    }

    if (inBand) {
      bands.push({
        center: sign * ((bandStart + maxDist) / 2),
        width: maxDist - bandStart + 1,
      });
    }
  }

  return bands;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

/**
 * @param {Object} params
 * @param {ImageData} params.imageData          Full base-map ImageData
 * @param {Array<{x:number,y:number}>} params.centerlinePoints  Source strip centerline (image px)
 * @param {number} params.stripWidthPx          Reference strip width in image px
 * @param {{x:number,y:number,width:number,height:number}} params.viewportBBox  Viewport in image px
 * @param {number} [params.stripOrientation=1]    Strip orientation (1 or -1)
 * @param {number} [params.darknessThreshold=128]
 * @param {number} [params.widthTolerance=0.30]   ±30 % of reference width
 * @param {number} [params.sampleCount=5]
 * @param {Uint8Array} [params.exclusionMask]      Pixel mask (1 = excluded annotation)
 * @param {number} [params.minConfirmations]      Auto-computed if omitted
 * @returns {Array<{offset:number, bandWidth:number}>}
 */
export default function detectSimilarStrips({
  imageData,
  centerlinePoints,
  stripWidthPx,
  viewportBBox,
  stripOrientation = 1,
  darknessThreshold = 128,
  widthTolerance = 0.30,
  sampleCount = 10,
  exclusionMask,
  minConfirmations,
}) {
  if (!imageData || !centerlinePoints || centerlinePoints.length < 2) return [];

  const normal = computeNormal(centerlinePoints);
  const anchors = sampleAnchors(centerlinePoints, sampleCount);
  const effectiveSampleCount = anchors.length;

  // Auto-compute minConfirmations: 70% of rays
  const minConf = minConfirmations ?? Math.max(1, Math.ceil(effectiveSampleCount * 0.7));

  const maxDist = Math.ceil(
    Math.sqrt(
      viewportBBox.width * viewportBBox.width +
        viewportBBox.height * viewportBBox.height
    )
  );

  const minWidth = stripWidthPx * (1 - widthTolerance);
  const maxWidth = stripWidthPx * (1 + widthTolerance);

  // Collect valid band data from each ray
  const allBands = []; // Array<Array<{offset, bandWidth}>>

  for (const anchor of anchors) {
    const bands = scanRay(
      imageData,
      anchor,
      normal,
      maxDist,
      darknessThreshold,
      viewportBBox,
      exclusionMask
    );

    // Filter bands matching reference width, skip the source strip.
    // The source wall occupies roughly [0, stripWidthPx] along the ray
    // (or [0, -stripWidthPx] depending on orientation), so skip bands
    // whose center is within 1× stripWidth of origin.
    const validBands = bands
      .filter((b) => b.width >= minWidth && b.width <= maxWidth)
      .filter((b) => Math.abs(b.center) > stripWidthPx * 1.0)
      .map((b) => ({
        // Correct offset: band center → centerline edge.
        // The centerline is at the edge from which the strip extends
        // in the normal direction. For stripOrientation=1 this is
        // center − width/2; for −1 it's center + width/2.
        offset: b.center - stripOrientation * b.width / 2,
        bandWidth: b.width,
      }));

    allBands.push(validBands);
  }

  // Cross-validate: cluster offsets across rays
  const flat = [];
  allBands.forEach((bands, rayIdx) => {
    bands.forEach((b) => flat.push({ ...b, rayIdx }));
  });

  flat.sort((a, b) => a.offset - b.offset);

  // Cluster by proximity
  const clusterTolerance = stripWidthPx * 0.5;
  const clusters = [];
  let currentCluster = null;

  for (const item of flat) {
    if (
      !currentCluster ||
      Math.abs(item.offset - currentCluster.sum / currentCluster.items.length) > clusterTolerance
    ) {
      if (currentCluster) clusters.push(currentCluster);
      currentCluster = {
        items: [item],
        sum: item.offset,
        widthSum: item.bandWidth,
        rays: new Set([item.rayIdx]),
      };
    } else {
      currentCluster.items.push(item);
      currentCluster.sum += item.offset;
      currentCluster.widthSum += item.bandWidth;
      currentCluster.rays.add(item.rayIdx);
    }
  }
  if (currentCluster) clusters.push(currentCluster);

  // Keep clusters confirmed by enough rays
  const confirmed = clusters
    .filter((c) => c.rays.size >= minConf)
    .map((c) => ({
      offset: c.sum / c.items.length,
      bandWidth: c.widthSum / c.items.length,
    }));

  return confirmed;
}
