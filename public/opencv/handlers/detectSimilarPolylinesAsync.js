/**
 * Worker handler for detecting horizontal and vertical line segments
 * whose color matches the clicked line.
 *
 * Flow:
 *   1. Load image → extract RGB at click point
 *   2. Build color-match mask (Euclidean RGB distance)
 *   3. Calibrate thickness from click point
 *   4. Scan horizontal bands → H segments
 *   5. Scan vertical bands → V segments
 *   6. Filter out thick zones (solid fills, not lines)
 *   7. Merge colinear segments
 *   8. Deduplicate vs existing annotations
 *   9. Snap endpoints to perpendicular segments
 *  10. Resolve topology (L, T, X intersections)
 *  11. Return polylines
 */
async function detectSimilarPolylinesAsync({ msg, payload }) {
  try {
    const {
      imageUrl,
      clickX,
      clickY,
      existingSegments = [],
      colorTolerance = 80,
    } = payload;

    if (!imageUrl) throw new Error("imageUrl is required");

    // 1. Load image data
    const imageData = await loadImageDataFromUrl(imageUrl);
    const { width, height, data } = imageData;

    // 2. Extract target color at click point
    const cx = Math.round(clickX);
    const cy = Math.round(clickY);
    const targetColor = _extractClickColor(data, width, height, cx, cy);

    // 3. Build brightness array (for visual thickness measurement)
    const brightness = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      brightness[i] = Math.round(
        data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114
      );
    }

    // 4. Build color-match mask
    //    For dark lines (brightness < 80), use brightness threshold calibrated
    //    from the click point. We measure the visual thickness (including
    //    antialiasing) and set the threshold just above the darkest gradient edge.
    //    For colored lines, use Euclidean RGB distance.
    const targetBrightness = targetColor.r * 0.299 + targetColor.g * 0.587 + targetColor.b * 0.114;
    const isDarkLine = targetBrightness < 80;

    // For dark lines: use a fixed brightness threshold of 128 (standard
    // binarization midpoint for architectural plans with black lines on white).
    // This captures the full line core + antialiasing gradient while excluding
    // the white background. The _filterThickSegments step handles solid fills.
    const brightnessThreshold = isDarkLine ? 128 : 100;

    const isMatch = new Uint8Array(width * height);
    if (isDarkLine) {
      for (let i = 0; i < width * height; i++) {
        if (brightness[i] < brightnessThreshold) {
          isMatch[i] = 1;
        }
      }
    } else {
      // Colored lines: use Euclidean RGB distance
      const tolSq = colorTolerance * colorTolerance;
      for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        const dr = data[idx] - targetColor.r;
        const dg = data[idx + 1] - targetColor.g;
        const db = data[idx + 2] - targetColor.b;
        if (dr * dr + dg * dg + db * db <= tolSq) {
          isMatch[i] = 1;
        }
      }
    }

    // 5. Calibrate thickness from click point on the color-match mask
    const calibration = _calibrate(isMatch, width, height, cx, cy, brightness);
    if (!calibration) {
      postMessage({ msg, payload: { polylines: [], thickness: 2 } });
      return;
    }

    const { thickness, visualThickness } = calibration;
    // Position tolerance for merge: must cover the full antialiasing gradient
    const mergeTolerance = Math.max(Math.round(thickness * 1.5), 2);
    const minRunLength = Math.max(Math.round(thickness * 5), 10);
    const bandHeight = Math.max(thickness * 2, 4);
    const step = Math.max(Math.round(thickness / 2), 1);
    const maxThickness = thickness * 4; // reject solid fills thicker than this

    // 5. Build exclusion mask from existing segments
    if (existingSegments.length > 0) {
      const radius = thickness;
      for (const seg of existingSegments) {
        for (let i = 0; i < seg.length - 1; i++) {
          _rasterizeSegment(isMatch, width, height, seg[i], seg[i + 1], radius, 0);
        }
      }
    }

    // 6. Scan for horizontal segments
    const hSegments = _scanHorizontal(isMatch, width, height, bandHeight, step, minRunLength);

    // 7. Scan for vertical segments
    const vSegments = _scanVertical(isMatch, width, height, bandHeight, step, minRunLength);

    // 8. Filter out thick zones (solid areas, not thin lines)
    const filteredH = _filterThickSegments(hSegments, isMatch, width, height, "H", maxThickness);
    const filteredV = _filterThickSegments(vSegments, isMatch, width, height, "V", maxThickness);

    // 9. Merge colinear segments (uses wide tolerance to collapse antialiased parallels)
    //    Conservative gap tolerance for merging: just enough to bridge small noise
    const mergeGap = thickness * 3;
    const mergedH = _mergeColinear(filteredH, mergeTolerance, mergeGap);
    const mergedV = _mergeColinear(filteredV, mergeTolerance, mergeGap);

    // 9b. Deduplicate remaining parallel segments
    //     After merge, some parallel segments may survive if their ranges don't overlap.
    //     Collapse segments at similar positions with overlapping ranges.
    const dedupH = _deduplicateParallel(mergedH, mergeTolerance);
    const dedupV = _deduplicateParallel(mergedV, mergeTolerance);

    // 9c. Center segments on the median line of the dark band
    //     The band scanning may detect at a position offset from the true center.
    //     For each segment, sample the perpendicular brightness profile at several
    //     points and adjust position to the middle of the dark band.
    _centerOnMedian(dedupH, brightness, width, height, "H");
    _centerOnMedian(dedupV, brightness, width, height, "V");

    // 9d. Fill dashed lines — merge consecutive segments on the same line
    //     when the gap between them is actually covered by dark pixels.
    //     This handles cases where noise/antialiasing causes the band scanner
    //     to produce short gaps in what is visually a continuous line.
    const filledH = _fillDashedLines(dedupH, brightness, width, height, "H");
    const filledV = _fillDashedLines(dedupV, brightness, width, height, "V");

    // 10. Snap endpoints to perpendicular segments
    const snapTolerance = thickness * 2;
    _snapEndpoints(filledH, filledV, snapTolerance);

    // 11. Resolve topology — find intersections and split
    const allSegments = _resolveTopology(filledH, filledV, mergeTolerance);

    // 12. Convert to polylines [{x,y},{x,y}]
    const polylines = allSegments.map((seg) => {
      if (seg.axis === "H") {
        return [
          { x: seg.start, y: seg.position },
          { x: seg.end, y: seg.position },
        ];
      } else {
        return [
          { x: seg.position, y: seg.start },
          { x: seg.position, y: seg.end },
        ];
      }
    });

    // Filter out very short segments
    const filtered = polylines.filter((pl) => {
      const dx = pl[1].x - pl[0].x;
      const dy = pl[1].y - pl[0].y;
      return Math.sqrt(dx * dx + dy * dy) >= minRunLength;
    });

    postMessage({ msg, payload: { polylines: filtered, thickness: visualThickness } });
  } catch (err) {
    postMessage({ msg, error: err.message || String(err) });
  }
}

// ─── COLOR EXTRACTION ─────────────────────────────────────────────────────

/**
 * Extract the target color from the click point by finding the DARKEST pixel
 * in a small neighborhood. This ensures we capture the core color of the line
 * even if the user clicks on the antialiased edge.
 *
 * Using the darkest pixel (rather than average) ensures the color-match mask
 * will include the full core of lines of the same type, because the tolerance
 * radius extends outward from the darkest core.
 */
function _extractClickColor(data, width, height, cx, cy) {
  const radius = 5;
  let bestR = 255, bestG = 255, bestB = 255;
  let bestBrightness = 999;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const px = cx + dx;
      const py = cy + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const idx = (py * width + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const bright = r * 0.299 + g * 0.587 + b * 0.114;
      if (bright < bestBrightness) {
        bestBrightness = bright;
        bestR = r;
        bestG = g;
        bestB = b;
      }
    }
  }

  return { r: bestR, g: bestG, b: bestB };
}

// ─── CALIBRATION ──────────────────────────────────────────────────────────

/**
 * Calibrate from click point.
 * Returns:
 *   - thickness: core line thickness (color-matched pixels) for band scanning
 *   - visualThickness: full visual extent including antialiasing gradient (for strokeWidth)
 */
function _calibrate(isMatch, width, height, clickX, clickY, brightness) {
  function matched(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    return isMatch[y * width + x] === 1;
  }

  // Snap to nearest matching pixel
  let sx = clickX;
  let sy = clickY;
  if (!matched(sx, sy)) {
    let found = false;
    for (let r = 1; r <= 30 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          if (matched(sx + dx, sy + dy)) {
            sx += dx;
            sy += dy;
            found = true;
          }
        }
      }
    }
    if (!found) return null;
  }

  // Measure core thickness (color-matched pixels only)
  let left = 0, right = 0, top = 0, bottom = 0;
  for (let d = 1; d < 200; d++) { if (matched(sx - d, sy)) left = d; else break; }
  for (let d = 1; d < 200; d++) { if (matched(sx + d, sy)) right = d; else break; }
  for (let d = 1; d < 200; d++) { if (matched(sx, sy - d)) top = d; else break; }
  for (let d = 1; d < 200; d++) { if (matched(sx, sy + d)) bottom = d; else break; }

  const hExtent = left + right + 1;
  const vExtent = top + bottom + 1;
  const thickness = Math.min(hExtent, vExtent);

  if (thickness < 1) return null;

  // Measure visual thickness including antialiasing gradient
  // Use brightness: extend until pixel is clearly background (> 240)
  const bgThreshold = 240;
  let vLeft = 0, vRight = 0, vTop = 0, vBottom = 0;
  for (let d = 1; d < 200; d++) {
    const px = sx - d;
    if (px < 0 || brightness[sy * width + px] > bgThreshold) break;
    vLeft = d;
  }
  for (let d = 1; d < 200; d++) {
    const px = sx + d;
    if (px >= width || brightness[sy * width + px] > bgThreshold) break;
    vRight = d;
  }
  for (let d = 1; d < 200; d++) {
    const py = sy - d;
    if (py < 0 || brightness[py * width + sx] > bgThreshold) break;
    vTop = d;
  }
  for (let d = 1; d < 200; d++) {
    const py = sy + d;
    if (py >= height || brightness[py * width + sx] > bgThreshold) break;
    vBottom = d;
  }
  const vhExtent = vLeft + vRight + 1;
  const vvExtent = vTop + vBottom + 1;
  const visualThickness = Math.min(vhExtent, vvExtent);

  return {
    thickness: Math.max(thickness, 2),
    visualThickness: Math.max(visualThickness, thickness, 2),
  };
}

// ─── BAND SCANNING ────────────────────────────────────────────────────────

function _scanHorizontal(isMatch, width, height, bandHeight, step, minRunLength) {
  const segments = [];
  const halfBand = Math.floor(bandHeight / 2);

  for (let yCenter = 0; yCenter < height; yCenter += step) {
    const y0 = Math.max(0, yCenter - halfBand);
    const y1 = Math.min(height - 1, yCenter + halfBand);
    const bandH = y1 - y0 + 1;
    if (bandH < 1) continue;

    let runStart = -1;

    for (let x = 0; x < width; x++) {
      let matchCount = 0;
      for (let y = y0; y <= y1; y++) {
        if (isMatch[y * width + x]) matchCount++;
      }
      const density = matchCount / bandH;

      if (density > 0.4) {
        if (runStart < 0) runStart = x;
      } else {
        if (runStart >= 0) {
          const runLen = x - runStart;
          if (runLen >= minRunLength) {
            segments.push({ axis: "H", position: yCenter, start: runStart, end: x - 1 });
          }
          runStart = -1;
        }
      }
    }
    if (runStart >= 0) {
      const runLen = width - runStart;
      if (runLen >= minRunLength) {
        segments.push({ axis: "H", position: yCenter, start: runStart, end: width - 1 });
      }
    }
  }

  return segments;
}

function _scanVertical(isMatch, width, height, bandHeight, step, minRunLength) {
  const segments = [];
  const halfBand = Math.floor(bandHeight / 2);

  for (let xCenter = 0; xCenter < width; xCenter += step) {
    const x0 = Math.max(0, xCenter - halfBand);
    const x1 = Math.min(width - 1, xCenter + halfBand);
    const bandW = x1 - x0 + 1;
    if (bandW < 1) continue;

    let runStart = -1;

    for (let y = 0; y < height; y++) {
      let matchCount = 0;
      for (let x = x0; x <= x1; x++) {
        if (isMatch[y * width + x]) matchCount++;
      }
      const density = matchCount / bandW;

      if (density > 0.4) {
        if (runStart < 0) runStart = y;
      } else {
        if (runStart >= 0) {
          const runLen = y - runStart;
          if (runLen >= minRunLength) {
            segments.push({ axis: "V", position: xCenter, start: runStart, end: y - 1 });
          }
          runStart = -1;
        }
      }
    }
    if (runStart >= 0) {
      const runLen = height - runStart;
      if (runLen >= minRunLength) {
        segments.push({ axis: "V", position: xCenter, start: runStart, end: height - 1 });
      }
    }
  }

  return segments;
}

// ─── FILTER THICK ZONES ──────────────────────────────────────────────────

/**
 * For each segment, measure the perpendicular extent of matched pixels
 * at several sample points. If the median extent > maxThickness, reject it
 * (it's a solid filled zone, not a thin line).
 */
function _filterThickSegments(segments, isMatch, width, height, axis, maxThickness) {
  return segments.filter((seg) => {
    const len = seg.end - seg.start;
    const numSamples = Math.min(5, Math.max(2, Math.floor(len / 10)));
    const extents = [];

    for (let s = 0; s < numSamples; s++) {
      const t = seg.start + Math.round((s + 0.5) * len / numSamples);
      let extent = 1;

      if (axis === "H") {
        // Measure vertical extent at x=t, y=seg.position
        for (let d = 1; d < 300; d++) {
          const py = seg.position - d;
          if (py < 0 || !isMatch[py * width + t]) break;
          extent++;
        }
        for (let d = 1; d < 300; d++) {
          const py = seg.position + d;
          if (py >= height || !isMatch[py * width + t]) break;
          extent++;
        }
      } else {
        // Measure horizontal extent at y=t, x=seg.position
        for (let d = 1; d < 300; d++) {
          const px = seg.position - d;
          if (px < 0 || !isMatch[t * width + px]) break;
          extent++;
        }
        for (let d = 1; d < 300; d++) {
          const px = seg.position + d;
          if (px >= width || !isMatch[t * width + px]) break;
          extent++;
        }
      }

      extents.push(extent);
    }

    // Median extent
    extents.sort((a, b) => a - b);
    const median = extents[Math.floor(extents.length / 2)];
    // Reject solid fills
    if (median > maxThickness) return false;
    // Reject curve artifacts: segment length must be >= 3× perpendicular extent
    // (a real H/V line is much longer than it is thick)
    if (len < median * 3) return false;
    return true;
  });
}

// ─── MERGE COLINEAR ───────────────────────────────────────────────────────

function _mergeColinear(segments, positionTolerance, gapTolerance) {
  if (segments.length === 0) return [];

  const sorted = [...segments].sort((a, b) => {
    const posDiff = a.position - b.position;
    if (Math.abs(posDiff) > positionTolerance) return posDiff;
    return a.start - b.start;
  });

  const merged = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const seg = sorted[i];
    const samePosition = Math.abs(seg.position - current.position) <= positionTolerance;
    const overlapsOrClose = seg.start <= current.end + gapTolerance;

    if (samePosition && overlapsOrClose) {
      current.end = Math.max(current.end, seg.end);
      current.position = Math.round((current.position + seg.position) / 2);
    } else {
      merged.push(current);
      current = { ...seg };
    }
  }
  merged.push(current);

  return merged;
}

// ─── DEDUPLICATE PARALLEL ─────────────────────────────────────────────────

/**
 * Collapse parallel segments that are at nearly the same position and
 * overlap in their start/end range. Keeps the longest, averages position.
 * This handles antialiased lines producing multiple parallel detections.
 */
function _deduplicateParallel(segments, positionTolerance) {
  if (segments.length <= 1) return segments;

  // Sort by position
  const sorted = [...segments].sort((a, b) => a.position - b.position);
  const used = new Array(sorted.length).fill(false);
  const result = [];

  for (let i = 0; i < sorted.length; i++) {
    if (used[i]) continue;

    let group = [sorted[i]];
    used[i] = true;

    // Find all segments at similar position that overlap in range
    for (let j = i + 1; j < sorted.length; j++) {
      if (used[j]) continue;
      if (sorted[j].position - sorted[i].position > positionTolerance) break;

      // Check range overlap
      const a = group[0]; // use first as reference for range
      const b = sorted[j];
      const overlapStart = Math.max(a.start, b.start);
      const overlapEnd = Math.min(a.end, b.end);
      if (overlapEnd >= overlapStart) {
        group.push(b);
        used[j] = true;
      }
    }

    // Merge group into one segment: average position, union range
    const avgPos = Math.round(group.reduce((s, g) => s + g.position, 0) / group.length);
    const minStart = Math.min(...group.map((g) => g.start));
    const maxEnd = Math.max(...group.map((g) => g.end));

    result.push({
      axis: group[0].axis,
      position: avgPos,
      start: minStart,
      end: maxEnd,
    });
  }

  return result;
}

// ─── CENTER ON MEDIAN LINE ────────────────────────────────────────────────

/**
 * For each segment, sample the perpendicular brightness profile at several
 * points along its length. Find the center of the dark band and adjust
 * the segment position to the median center.
 *
 * This corrects the position from "band scan center" to "actual line center",
 * which matters for antialiased PDF-rendered lines where the gradient extends
 * well beyond the core.
 */
function _centerOnMedian(segments, brightness, width, height, axis) {
  const bgThreshold = 200; // lighter than this = background

  for (const seg of segments) {
    const len = seg.end - seg.start;
    const numSamples = Math.min(5, Math.max(2, Math.floor(len / 20)));
    const centers = [];

    for (let s = 0; s < numSamples; s++) {
      const t = seg.start + Math.round((s + 0.5) * len / numSamples);

      if (axis === "H") {
        // Segment at y=seg.position, sample column x=t, scan vertically
        const x = Math.min(width - 1, Math.max(0, t));
        let topEdge = seg.position;
        let botEdge = seg.position;
        for (let d = 1; d < 200; d++) {
          const py = seg.position - d;
          if (py < 0 || brightness[py * width + x] > bgThreshold) break;
          topEdge = py;
        }
        for (let d = 1; d < 200; d++) {
          const py = seg.position + d;
          if (py >= height || brightness[py * width + x] > bgThreshold) break;
          botEdge = py;
        }
        centers.push(Math.round((topEdge + botEdge) / 2));
      } else {
        // Segment at x=seg.position, sample row y=t, scan horizontally
        const y = Math.min(height - 1, Math.max(0, t));
        let leftEdge = seg.position;
        let rightEdge = seg.position;
        for (let d = 1; d < 200; d++) {
          const px = seg.position - d;
          if (px < 0 || brightness[y * width + px] > bgThreshold) break;
          leftEdge = px;
        }
        for (let d = 1; d < 200; d++) {
          const px = seg.position + d;
          if (px >= width || brightness[y * width + px] > bgThreshold) break;
          rightEdge = px;
        }
        centers.push(Math.round((leftEdge + rightEdge) / 2));
      }
    }

    if (centers.length > 0) {
      // Use median for robustness
      centers.sort((a, b) => a - b);
      seg.position = centers[Math.floor(centers.length / 2)];
    }
  }
}

// ─── FILL DASHED LINES ───────────────────────────────────────────────────

/**
 * Post-processing pass: merge consecutive segments on the same line when
 * the gap between them is covered by dark pixels in the source image.
 *
 * For each pair of consecutive segments (same axis, close position):
 *   1. Compute the gap between seg[i].end and seg[i+1].start
 *   2. Sample the brightness along the gap at the segment's position
 *   3. If most of the gap pixels are dark (> 60% below threshold),
 *      the gap is a continuous line that the band scanner missed → merge
 */
function _fillDashedLines(segments, brightness, width, height, axis) {
  if (segments.length <= 1) return segments;

  // Sort by position then by start
  const sorted = [...segments].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.start - b.start;
  });

  // Use a generous brightness threshold for gap checking:
  // if the gap contains pixels darker than this, it's a line not a real gap.
  const gapDarkThreshold = 180;
  const minDarkRatio = 0.8; // 80% of gap pixels must be dark

  const result = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Only merge segments at the same position (within a few pixels)
    const samePosition = Math.abs(next.position - current.position) <= 3;
    if (!samePosition) {
      result.push(current);
      current = { ...next };
      continue;
    }

    const gapStart = current.end + 1;
    const gapEnd = next.start - 1;
    const gapLen = gapEnd - gapStart + 1;

    // No gap or overlapping → just merge
    if (gapLen <= 0) {
      current.end = Math.max(current.end, next.end);
      continue;
    }

    // Sample the brightness along the gap at the segment's perpendicular position
    let darkCount = 0;
    const pos = Math.round((current.position + next.position) / 2);

    if (axis === "H") {
      // H segment: position = Y, start/end = X range
      // Sample along X from gapStart to gapEnd at Y = pos
      if (pos >= 0 && pos < height) {
        for (let x = gapStart; x <= gapEnd; x++) {
          if (x >= 0 && x < width && brightness[pos * width + x] < gapDarkThreshold) {
            darkCount++;
          }
        }
      }
    } else {
      // V segment: position = X, start/end = Y range
      // Sample along Y from gapStart to gapEnd at X = pos
      if (pos >= 0 && pos < width) {
        for (let y = gapStart; y <= gapEnd; y++) {
          if (y >= 0 && y < height && brightness[y * width + pos] < gapDarkThreshold) {
            darkCount++;
          }
        }
      }
    }

    const darkRatio = gapLen > 0 ? darkCount / gapLen : 0;

    if (darkRatio >= minDarkRatio) {
      // Gap is mostly dark → fill it, merge the two segments
      current.end = Math.max(current.end, next.end);
      current.position = Math.round((current.position + next.position) / 2);
    } else {
      // Real gap → keep them separate
      result.push(current);
      current = { ...next };
    }
  }
  result.push(current);

  return result;
}

// ─── SNAP ENDPOINTS ───────────────────────────────────────────────────────

function _snapEndpoints(hSegments, vSegments, snapTolerance) {
  for (const h of hSegments) {
    for (const v of vSegments) {
      if (Math.abs(h.start - v.position) <= snapTolerance &&
          h.position >= v.start - snapTolerance &&
          h.position <= v.end + snapTolerance) {
        h.start = v.position;
      }
      if (Math.abs(h.end - v.position) <= snapTolerance &&
          h.position >= v.start - snapTolerance &&
          h.position <= v.end + snapTolerance) {
        h.end = v.position;
      }
    }
  }

  for (const v of vSegments) {
    for (const h of hSegments) {
      if (Math.abs(v.start - h.position) <= snapTolerance &&
          v.position >= h.start - snapTolerance &&
          v.position <= h.end + snapTolerance) {
        v.start = h.position;
      }
      if (Math.abs(v.end - h.position) <= snapTolerance &&
          v.position >= h.start - snapTolerance &&
          v.position <= h.end + snapTolerance) {
        v.end = h.position;
      }
    }
  }
}

// ─── TOPOLOGY RESOLUTION ──────────────────────────────────────────────────

function _resolveTopology(hSegments, vSegments, tolerance) {
  const hSplitPoints = new Map();
  const vSplitPoints = new Map();

  for (let hi = 0; hi < hSegments.length; hi++) {
    const h = hSegments[hi];
    for (let vi = 0; vi < vSegments.length; vi++) {
      const v = vSegments[vi];

      const ix = v.position;
      const iy = h.position;

      const inH = ix >= h.start - tolerance && ix <= h.end + tolerance;
      const inV = iy >= v.start - tolerance && iy <= v.end + tolerance;

      if (inH && inV) {
        const hThrough = ix > h.start + tolerance && ix < h.end - tolerance;
        const vThrough = iy > v.start + tolerance && iy < v.end - tolerance;

        if (hThrough) {
          if (!hSplitPoints.has(hi)) hSplitPoints.set(hi, []);
          hSplitPoints.get(hi).push(ix);
        }
        if (vThrough) {
          if (!vSplitPoints.has(vi)) vSplitPoints.set(vi, []);
          vSplitPoints.get(vi).push(iy);
        }
      }
    }
  }

  const result = [];

  for (let i = 0; i < hSegments.length; i++) {
    const seg = hSegments[i];
    const splits = hSplitPoints.get(i);
    if (splits && splits.length > 0) {
      const sorted = [...new Set(splits)].sort((a, b) => a - b);
      let current = seg.start;
      for (const sp of sorted) {
        if (sp > current + tolerance) {
          result.push({ axis: "H", position: seg.position, start: current, end: sp });
        }
        current = sp;
      }
      if (seg.end > current + tolerance) {
        result.push({ axis: "H", position: seg.position, start: current, end: seg.end });
      }
    } else {
      result.push(seg);
    }
  }

  for (let i = 0; i < vSegments.length; i++) {
    const seg = vSegments[i];
    const splits = vSplitPoints.get(i);
    if (splits && splits.length > 0) {
      const sorted = [...new Set(splits)].sort((a, b) => a - b);
      let current = seg.start;
      for (const sp of sorted) {
        if (sp > current + tolerance) {
          result.push({ axis: "V", position: seg.position, start: current, end: sp });
        }
        current = sp;
      }
      if (seg.end > current + tolerance) {
        result.push({ axis: "V", position: seg.position, start: current, end: seg.end });
      }
    } else {
      result.push(seg);
    }
  }

  return result;
}

// ─── RASTERIZE SEGMENT (for exclusion mask) ───────────────────────────────

/**
 * Rasterize a line segment into a mask. Sets pixels to `value` (default 0 = clear).
 */
function _rasterizeSegment(mask, width, height, p0, p1, half, value) {
  const val = value !== undefined ? value : 1;
  const dx = Math.abs(p1.x - p0.x);
  const dy = Math.abs(p1.y - p0.y);
  const sx = p0.x < p1.x ? 1 : -1;
  const sy = p0.y < p1.y ? 1 : -1;
  let err = dx - dy;
  let cx = Math.round(p0.x);
  let cy = Math.round(p0.y);
  const ex = Math.round(p1.x);
  const ey = Math.round(p1.y);

  for (let iter = 0; iter < 100000; iter++) {
    const x0 = Math.max(0, cx - half);
    const y0 = Math.max(0, cy - half);
    const x1 = Math.min(width - 1, cx + half);
    const y1 = Math.min(height - 1, cy + half);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        mask[y * width + x] = val;
      }
    }
    if (cx === ex && cy === ey) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
}
