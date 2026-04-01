/**
 * Worker handler for extracting wall geometry from a base map image
 * using polygon annotations (flood fill room contours) as masks.
 *
 * Revised pipeline:
 *   1. Load image
 *   2. Optional rotation of source image (same as detectSimilarPolylinesAsync)
 *      + re-threshold to eliminate interpolation blur
 *      + rotate boundary polygons with same transform
 *   3. Binarize rotated image
 *   4. Create wall mask: dark pixels NEAR rooms but NOT inside them
 *      (wallMask = binaryDark AND regionOfInterest AND NOT roomMask)
 *   5. Distance transform for thickness map
 *   6. Morphological skeletonization
 *   7. HoughLinesP to extract line segments
 *   8. Merge collinear segments
 *   9. Filter thick zones (solid fills)
 *  10. Measure wall thickness per segment via distance transform sampling
 *  11. Snap endpoints to perpendicular segments
 *  12. Resolve topology (L, T, X intersections)
 *  13. Rotate back if needed
 *  14. Return polylines + thicknesses
 */
async function vectoriseWallsAsync({ msg, payload }) {
  try {
    const {
      imageUrl,
      boundaries = [], // polygon contours in pixel coords
      offsetAngle = 0, // degrees
      meterByPx = 0,
    } = payload;

    if (!imageUrl) throw new Error("imageUrl is required");
    if (!boundaries.length) throw new Error("boundaries are required");

    // ── 1. Load image ──────────────────────────────────────────────────
    const imageData = await loadImageDataFromUrl(imageUrl);
    let { width, height, data } = imageData;

    // ── 2. Optional rotation of SOURCE IMAGE ───────────────────────────
    // Same pattern as detectSimilarPolylinesAsync:70-142
    const angleRad = (offsetAngle * Math.PI) / 180;
    let origCenterX, origCenterY;
    let workBoundaries = boundaries; // may be rotated

    if (offsetAngle !== 0) {
      origCenterX = width / 2;
      origCenterY = height / 2;

      const cosA = Math.abs(Math.cos(angleRad));
      const sinA = Math.abs(Math.sin(angleRad));
      const newWidth = Math.ceil(width * cosA + height * sinA);
      const newHeight = Math.ceil(width * sinA + height * cosA);
      const newCenterX = newWidth / 2;
      const newCenterY = newHeight / 2;

      // Rotate source image using OffscreenCanvas
      const origCanvas = new OffscreenCanvas(width, height);
      const origCtx = origCanvas.getContext("2d");
      const imgDataObj = new ImageData(new Uint8ClampedArray(data), width, height);
      origCtx.putImageData(imgDataObj, 0, 0);

      const rotCanvas = new OffscreenCanvas(newWidth, newHeight);
      const rotCtx = rotCanvas.getContext("2d");
      rotCtx.fillStyle = "#ffffff";
      rotCtx.fillRect(0, 0, newWidth, newHeight);
      rotCtx.translate(newCenterX, newCenterY);
      rotCtx.rotate(angleRad);
      rotCtx.translate(-origCenterX, -origCenterY);
      rotCtx.drawImage(origCanvas, 0, 0);

      const rotImageData = rotCtx.getImageData(0, 0, newWidth, newHeight);
      data = rotImageData.data;
      width = newWidth;
      height = newHeight;

      // Re-threshold to eliminate interpolation blur (same as detectSimilarPolylinesAsync:131-142)
      const threshold = 160;
      for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        const b = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        const v = b < threshold ? 0 : 255;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
      }

      // Rotate boundary polygons (and their cuts) with same transform
      const rotatePoint = (p) => {
        const dx = p.x - origCenterX;
        const dy = p.y - origCenterY;
        return {
          x: dx * Math.cos(angleRad) - dy * Math.sin(angleRad) + newCenterX,
          y: dx * Math.sin(angleRad) + dy * Math.cos(angleRad) + newCenterY,
        };
      };
      workBoundaries = boundaries.map((boundary) => ({
        points: boundary.points.map(rotatePoint),
        cuts: (boundary.cuts || []).map((cut) => ({
          points: cut.points.map(rotatePoint),
        })),
      }));
    }

    // ── 3. Create wall mask from flood fill boundaries ──────────────────
    // Flood fill polygons = room interiors (surfaces to exclude).
    // Walls = the space BETWEEN these flood fills within the bounding area.
    // Fill all room polygons as WHITE on a WHITE canvas → then invert:
    // everything NOT inside a room polygon = wall material.

    // 3a. Compute bounding box from boundary polygons
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const boundary of workBoundaries) {
      const pts = boundary.points;
      if (!pts || pts.length < 3) continue;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }

    if (!Number.isFinite(minX)) throw new Error("No valid boundary points found");

    // 3b. Region of interest = bounding box + padding for outer walls
    const padding = meterByPx > 0
      ? Math.round(0.5 / meterByPx) // ~50cm padding to capture thick outer walls
      : 50;
    const roiX0 = Math.max(0, Math.floor(minX) - padding);
    const roiY0 = Math.max(0, Math.floor(minY) - padding);
    const roiX1 = Math.min(width - 1, Math.ceil(maxX) + padding);
    const roiY1 = Math.min(height - 1, Math.ceil(maxY) + padding);

    // 3c. Fill room polygons on canvas → roomMask
    const roiW = roiX1 - roiX0 + 1;
    const roiH = roiY1 - roiY0 + 1;
    const maskCanvas = new OffscreenCanvas(roiW, roiH);
    const maskCtx = maskCanvas.getContext("2d");
    // Start with all black (= wall)
    maskCtx.fillStyle = "#000000";
    maskCtx.fillRect(0, 0, roiW, roiH);
    // Fill room interiors as white (= NOT wall)
    maskCtx.fillStyle = "#ffffff";
    for (const boundary of workBoundaries) {
      const pts = boundary.points;
      if (!pts || pts.length < 3) continue;
      maskCtx.beginPath();
      maskCtx.moveTo(pts[0].x - roiX0, pts[0].y - roiY0);
      for (let i = 1; i < pts.length; i++) {
        maskCtx.lineTo(pts[i].x - roiX0, pts[i].y - roiY0);
      }
      maskCtx.closePath();
      maskCtx.fill();
    }
    // Draw cuts (holes) as black — these are areas INSIDE the room polygon
    // that are NOT room (walls, pillars, etc.)
    maskCtx.fillStyle = "#000000";
    for (const boundary of workBoundaries) {
      const cuts = boundary.cuts;
      if (!cuts || cuts.length === 0) continue;
      for (const cut of cuts) {
        const pts = cut.points;
        if (!pts || pts.length < 3) continue;
        maskCtx.beginPath();
        maskCtx.moveTo(pts[0].x - roiX0, pts[0].y - roiY0);
        for (let i = 1; i < pts.length; i++) {
          maskCtx.lineTo(pts[i].x - roiX0, pts[i].y - roiY0);
        }
        maskCtx.closePath();
        maskCtx.fill();
      }
    }

    const maskImageData = maskCtx.getImageData(0, 0, roiW, roiH);

    // 3d. wallMask = NOT room (black pixels on the canvas = wall)
    // Also AND with binaryDark from the actual image to exclude light areas
    // in the padding zone that aren't walls (just empty space outside the plan)
    const wWidth = roiW;
    const wHeight = roiH;
    const wWallMask = new Uint8Array(wWidth * wHeight);
    const BINARY_THRESHOLD = 128;
    for (let i = 0; i < wWidth * wHeight; i++) {
      const isRoom = maskImageData.data[i * 4] > 128; // white = room
      if (isRoom) {
        wWallMask[i] = 0;
        continue;
      }
      // Not a room → check if it's actually dark on the source image (wall material)
      const imgX = (i % wWidth) + roiX0;
      const imgY = Math.floor(i / wWidth) + roiY0;
      const imgIdx = (imgY * width + imgX) * 4;
      const brightness = data[imgIdx] * 0.299 + data[imgIdx + 1] * 0.587 + data[imgIdx + 2] * 0.114;
      wWallMask[i] = brightness < BINARY_THRESHOLD ? 1 : 0;
    }

    // ── 5. Build OpenCV Mat + morphological cleanup ─────────────────────
    const wallMat = new cv.Mat(wHeight, wWidth, cv.CV_8UC1);
    for (let i = 0; i < wWidth * wHeight; i++) {
      wallMat.data[i] = wWallMask[i] ? 255 : 0;
    }

    // Close small gaps in walls
    const closeKernelSize = meterByPx > 0
      ? Math.max(3, Math.round(0.01 / meterByPx))
      : 3;
    const closeKernel = cv.Mat.ones(closeKernelSize, closeKernelSize, cv.CV_8U);
    cv.morphologyEx(wallMat, wallMat, cv.MORPH_CLOSE, closeKernel);
    closeKernel.delete();

    // Remove small isolated noise
    const openKernel = cv.Mat.ones(2, 2, cv.CV_8U);
    cv.morphologyEx(wallMat, wallMat, cv.MORPH_OPEN, openKernel);
    openKernel.delete();

    // ── 6. Distance transform ────────────────────────────────────────
    const distMat = new cv.Mat();
    cv.distanceTransform(wallMat, distMat, cv.DIST_L2, 3);

    // ── 7. Morphological skeletonization ───────────────────────────────
    const skeleton = _morphologicalSkeleton(wallMat);

    // ── 6. HoughLinesP ─────────────────────────────────────────────────
    const minLineLength = meterByPx > 0
      ? Math.max(10, Math.round(0.05 / meterByPx))
      : 10;
    const maxLineGap = meterByPx > 0
      ? Math.max(3, Math.round(0.02 / meterByPx))
      : 5;

    const lines = new cv.Mat();
    cv.HoughLinesP(skeleton, lines, 1, Math.PI / 180, 20, minLineLength, maxLineGap);

    // Parse line segments
    let rawSegments = [];
    for (let i = 0; i < lines.rows; i++) {
      const x1 = lines.data32S[i * 4];
      const y1 = lines.data32S[i * 4 + 1];
      const x2 = lines.data32S[i * 4 + 2];
      const y2 = lines.data32S[i * 4 + 3];
      rawSegments.push({ x1, y1, x2, y2 });
    }

    // ── 7. Post-process raw segments ────────────────────────────────────
    const postResult = _postProcessSegments(rawSegments, {
      wWallMask, wWidth, wHeight, distMat, meterByPx, maxLineGap,
    });
    let polylines = postResult.polylines;
    let thicknesses = postResult.thicknesses;

    // ── 13. Convert ROI coords back to full image coords ────────────────
    // Output coordinates are in ROI space — offset them back
    polylines = polylines.map((pl) =>
      pl.map((p) => ({
        x: p.x + roiX0,
        y: p.y + roiY0,
      }))
    );

    // ── 14. Rotate back to original image coords ─────────────────────
    if (offsetAngle !== 0) {
      const rotCenterX = width / 2;
      const rotCenterY = height / 2;
      polylines = polylines.map((pl) =>
        pl.map((p) => {
          const dx = p.x - rotCenterX;
          const dy = p.y - rotCenterY;
          return {
            x: dx * Math.cos(-angleRad) - dy * Math.sin(-angleRad) + origCenterX,
            y: dx * Math.sin(-angleRad) + dy * Math.cos(-angleRad) + origCenterY,
          };
        })
      );
    }

    // Cleanup OpenCV Mats
    wallMat.delete();
    distMat.delete();
    skeleton.delete();
    lines.delete();

    postMessage({
      msg,
      payload: { polylines, thicknesses },
    });
  } catch (err) {
    postMessage({ msg, error: err.message || String(err) });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Post-processing pipeline
// ═══════════════════════════════════════════════════════════════════════

/**
 * Full post-processing of raw HoughLinesP segments.
 * Phase 1: Classify H/V/diagonal, merge collinear, filter thick zones
 * Phase 2: Grid snap — align segments to a grid derived from their positions
 * Phase 3: Gap fill — bridge gaps between segments on the same grid line if image is dark
 * Phase 4: Snap endpoints, extend, resolve topology (L/T/X)
 * Phase 5: Curve merge — chain small diagonal segments into polylines
 */
function _postProcessSegments(rawSegments, ctx) {
  const { wWallMask, wWidth, wHeight, distMat, meterByPx, maxLineGap } = ctx;

  // ── Phase 1: Classify and merge ──────────────────────────────────────
  const ANGLE_TOL = Math.PI / 12; // 15°
  const hSegments = [];
  const vSegments = [];
  const diagonalSegments = [];

  for (const seg of rawSegments) {
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const angle = Math.atan2(Math.abs(dy), Math.abs(dx));

    if (angle < ANGLE_TOL) {
      const start = Math.min(seg.x1, seg.x2);
      const end = Math.max(seg.x1, seg.x2);
      const position = Math.round((seg.y1 + seg.y2) / 2);
      hSegments.push({ axis: "H", position, start, end });
    } else if (angle > Math.PI / 2 - ANGLE_TOL) {
      const start = Math.min(seg.y1, seg.y2);
      const end = Math.max(seg.y1, seg.y2);
      const position = Math.round((seg.x1 + seg.x2) / 2);
      vSegments.push({ axis: "V", position, start, end });
    } else {
      diagonalSegments.push(seg);
    }
  }

  const posTolerance = meterByPx > 0
    ? Math.max(3, Math.round(0.03 / meterByPx))
    : 5;
  const gapTolerance = meterByPx > 0
    ? Math.max(maxLineGap * 2, Math.round(0.10 / meterByPx))
    : maxLineGap * 3;

  let mergedH = _mergeColinear(hSegments, posTolerance, gapTolerance);
  let mergedV = _mergeColinear(vSegments, posTolerance, gapTolerance);

  // Filter thick zones (solid fills)
  const maxThickness = meterByPx > 0
    ? Math.round(0.80 / meterByPx)
    : 120;

  mergedH = _filterThickZones(mergedH, wWallMask, wWidth, wHeight, "H", maxThickness);
  mergedV = _filterThickZones(mergedV, wWallMask, wWidth, wHeight, "V", maxThickness);

  // ── Phase 2: Grid snap ───────────────────────────────────────────────
  // Build a grid from the positions of all H and V segments.
  // Cluster nearby positions into grid lines, then snap segments to them.
  const gridTolerance = meterByPx > 0
    ? Math.max(3, Math.round(0.02 / meterByPx))
    : 4;

  const hGridLines = _buildGridLines(mergedH.map((s) => s.position), gridTolerance);
  const vGridLines = _buildGridLines(mergedV.map((s) => s.position), gridTolerance);

  // Snap each segment's position to the nearest grid line
  for (const seg of mergedH) {
    seg.position = _snapToGrid(seg.position, hGridLines);
  }
  for (const seg of mergedV) {
    seg.position = _snapToGrid(seg.position, vGridLines);
  }

  // Re-merge after snapping (segments that were close may now share the same position)
  mergedH = _mergeColinear(mergedH, 1, gapTolerance);
  mergedV = _mergeColinear(mergedV, 1, gapTolerance);

  // ── Phase 3: Gap fill ────────────────────────────────────────────────
  // On each grid line, check gaps between consecutive segments.
  // If the image is mostly dark in the gap, bridge it.
  const gapFillMaxDistance = meterByPx > 0
    ? Math.round(0.30 / meterByPx) // max 30cm gap to fill
    : 40;

  mergedH = _fillGapsOnGridLines(mergedH, wWallMask, wWidth, wHeight, "H",
    gapFillMaxDistance, distMat);
  mergedV = _fillGapsOnGridLines(mergedV, wWallMask, wWidth, wHeight, "V",
    gapFillMaxDistance, distMat);

  // ── Phase 4: Measure thickness, snap endpoints, topology ─────────────
  const hThicknesses = mergedH.map((seg) =>
    _measureThickness(seg, distMat, wWidth, wHeight)
  );
  const vThicknesses = mergedV.map((seg) =>
    _measureThickness(seg, distMat, wWidth, wHeight)
  );

  const snapTolerance = meterByPx > 0
    ? Math.max(5, Math.round(0.05 / meterByPx))
    : 8;
  _snapEndpoints(mergedH, mergedV, snapTolerance);

  const extendTolerance = meterByPx > 0
    ? Math.max(8, Math.round(0.15 / meterByPx))
    : 15;
  _extendEndpoints(mergedH, mergedV, extendTolerance);

  const resolved = _resolveTopology(mergedH, mergedV, snapTolerance);
  const resolvedThicknesses = _mapThicknessesAfterSplit(
    resolved, mergedH, mergedV, hThicknesses, vThicknesses
  );

  // Convert H/V segments to endpoint pairs for curve chaining
  const allEndpointPairs = [];
  const allPairThicknesses = [];

  for (let i = 0; i < resolved.length; i++) {
    const seg = resolved[i];
    let p1, p2;
    if (seg.axis === "H") {
      p1 = { x: seg.start, y: seg.position };
      p2 = { x: seg.end, y: seg.position };
    } else {
      p1 = { x: seg.position, y: seg.start };
      p2 = { x: seg.position, y: seg.end };
    }
    allEndpointPairs.push({ p1, p2 });
    allPairThicknesses.push(resolvedThicknesses[i]);
  }

  // Add diagonal segments
  for (const seg of diagonalSegments) {
    allEndpointPairs.push({
      p1: { x: seg.x1, y: seg.y1 },
      p2: { x: seg.x2, y: seg.y2 },
    });
    allPairThicknesses.push(
      _measureThicknessDiagonal(seg, distMat, wWidth, wHeight)
    );
  }

  // ── Phase 5: Chain colinear segments with dark-pixel continuity ──────
  // Two segments are chained if they are roughly colinear AND the pixels
  // between them on the wall mask are predominantly dark (= wall continuity).
  const colinearDistTol = meterByPx > 0
    ? Math.max(5, Math.round(0.05 / meterByPx)) // 5cm perpendicular tolerance
    : 8;
  const darkThreshold = 0.4; // 40% of gap pixels must be dark

  const chainResult = _chainColinearSegments(
    allEndpointPairs, allPairThicknesses,
    colinearDistTol, darkThreshold, wWallMask, wWidth, wHeight
  );

  return { polylines: chainResult.polylines, thicknesses: chainResult.thicknesses };
}

// ═══════════════════════════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════════════════════════

/**
 * Build grid lines by clustering nearby positions.
 * Returns sorted array of grid positions (averages of clusters).
 */
function _buildGridLines(positions, tolerance) {
  if (positions.length === 0) return [];
  const sorted = [...positions].sort((a, b) => a - b);
  const lines = [];
  let clusterSum = sorted[0];
  let clusterCount = 1;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= tolerance) {
      clusterSum += sorted[i];
      clusterCount++;
    } else {
      lines.push(Math.round(clusterSum / clusterCount));
      clusterSum = sorted[i];
      clusterCount = 1;
    }
  }
  lines.push(Math.round(clusterSum / clusterCount));
  return lines;
}

/**
 * Snap a position to the nearest grid line.
 */
function _snapToGrid(position, gridLines) {
  let bestDist = Infinity;
  let bestLine = position;
  for (const line of gridLines) {
    const dist = Math.abs(position - line);
    if (dist < bestDist) {
      bestDist = dist;
      bestLine = line;
    }
  }
  return bestLine;
}

/**
 * Fill gaps between consecutive segments on the same grid line.
 * Checks if the image is mostly dark (wall) in the gap region.
 */
function _fillGapsOnGridLines(segments, mask, w, h, axis, maxGap, distMat) {
  // Group segments by position (grid line)
  const byPosition = new Map();
  for (const seg of segments) {
    const key = seg.position;
    if (!byPosition.has(key)) byPosition.set(key, []);
    byPosition.get(key).push(seg);
  }

  const result = [];
  for (const [position, segs] of byPosition) {
    // Sort by start
    segs.sort((a, b) => a.start - b.start);

    const merged = [{ ...segs[0] }];
    for (let i = 1; i < segs.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = segs[i];
      const gap = curr.start - prev.end;

      if (gap <= 0) {
        // Overlapping — merge
        prev.end = Math.max(prev.end, curr.end);
      } else if (gap <= maxGap) {
        // Check if the gap is mostly dark (wall material)
        const darkRatio = _measureDarkRatio(
          position, prev.end, curr.start, mask, w, h, axis
        );
        if (darkRatio > 0.4) {
          // Bridge the gap
          prev.end = curr.end;
        } else {
          merged.push({ ...curr });
        }
      } else {
        merged.push({ ...curr });
      }
    }
    result.push(...merged);
  }
  return result;
}

/**
 * Measure what fraction of pixels in a gap region is dark (wall).
 */
function _measureDarkRatio(position, start, end, mask, w, h, axis) {
  let darkCount = 0;
  let totalCount = 0;
  const halfWidth = 3; // check a narrow band around the position

  for (let t = Math.round(start); t <= Math.round(end); t++) {
    for (let d = -halfWidth; d <= halfWidth; d++) {
      let px, py;
      if (axis === "H") {
        px = t;
        py = position + d;
      } else {
        px = position + d;
        py = t;
      }
      if (px < 0 || px >= w || py < 0 || py >= h) continue;
      totalCount++;
      if (mask[py * w + px]) darkCount++;
    }
  }

  return totalCount > 0 ? darkCount / totalCount : 0;
}

/**
 * Chain colinear segments into multi-point polylines.
 * Two segments are chained if:
 * 1. Similar angle (within 10°)
 * 2. Perpendicular distance between their lines is small
 * 3. The pixels between them (in the gap) are predominantly dark (wall continuity)
 */
function _chainColinearSegments(pairs, pairThicknesses, perpDistTol, darkThreshold, mask, w, h) {
  if (pairs.length === 0) return { polylines: [], thicknesses: [] };

  const segData = pairs.map((p, i) => {
    const dx = p.p2.x - p.p1.x;
    const dy = p.p2.y - p.p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    return {
      idx: i, p1: p.p1, p2: p.p2, dx, dy, len,
      ux: len > 0 ? dx / len : 1,
      uy: len > 0 ? dy / len : 0,
      mx: (p.p1.x + p.p2.x) / 2,
      my: (p.p1.y + p.p2.y) / 2,
      angle: Math.atan2(dy, dx),
      thickness: pairThicknesses[i],
    };
  });

  const ANGLE_TOL = Math.PI / 18; // 10°
  const used = new Array(segData.length).fill(false);
  const polylines = [];
  const thicknesses = [];

  for (let i = 0; i < segData.length; i++) {
    if (used[i]) continue;
    used[i] = true;

    const group = [segData[i]];
    let changed = true;

    while (changed) {
      changed = false;
      for (let j = 0; j < segData.length; j++) {
        if (used[j]) continue;

        for (const member of group) {
          if (_areColinearWithDarkCheck(
            member, segData[j], ANGLE_TOL, perpDistTol, darkThreshold, mask, w, h
          )) {
            group.push(segData[j]);
            used[j] = true;
            changed = true;
            break;
          }
        }
      }
    }

    // Sort group by projection along the dominant direction
    const ref = group[0];
    group.sort((a, b) => {
      const projA = (a.mx - ref.p1.x) * ref.ux + (a.my - ref.p1.y) * ref.uy;
      const projB = (b.mx - ref.p1.x) * ref.ux + (b.my - ref.p1.y) * ref.uy;
      return projA - projB;
    });

    // Build polyline from ordered endpoints
    const chain = [];
    for (const seg of group) {
      const proj1 = (seg.p1.x - ref.p1.x) * ref.ux + (seg.p1.y - ref.p1.y) * ref.uy;
      const proj2 = (seg.p2.x - ref.p1.x) * ref.ux + (seg.p2.y - ref.p1.y) * ref.uy;
      if (proj1 <= proj2) {
        chain.push(seg.p1, seg.p2);
      } else {
        chain.push(seg.p2, seg.p1);
      }
    }

    // Deduplicate close consecutive points
    const deduped = [chain[0]];
    for (let k = 1; k < chain.length; k++) {
      const prev = deduped[deduped.length - 1];
      if (Math.hypot(chain[k].x - prev.x, chain[k].y - prev.y) > perpDistTol) {
        deduped.push(chain[k]);
      }
    }

    if (deduped.length >= 2) {
      polylines.push(deduped);
      const gt = group.map((s) => s.thickness).sort((a, b) => a - b);
      thicknesses.push(gt[Math.floor(gt.length / 2)]);
    }
  }

  return { polylines, thicknesses };
}

/**
 * Check if two segments are colinear AND connected by dark pixels.
 */
function _areColinearWithDarkCheck(segA, segB, angleTol, perpTol, darkThreshold, mask, w, h) {
  // 1. Check angle similarity
  let dAngle = Math.abs(segA.angle - segB.angle);
  if (dAngle > Math.PI) dAngle = 2 * Math.PI - dAngle;
  if (dAngle > Math.PI / 2) dAngle = Math.PI - dAngle;
  if (dAngle > angleTol) return false;

  // 2. Perpendicular distance of B's midpoint to A's line
  const dxBmA = segB.mx - segA.p1.x;
  const dyBmA = segB.my - segA.p1.y;
  const perpDist = Math.abs(dxBmA * (-segA.uy) + dyBmA * segA.ux);
  if (perpDist > perpTol) return false;

  // 3. Find the gap endpoints (closest endpoints between the two segments)
  const endpoints = [
    { from: segA.p2, to: segB.p1 },
    { from: segA.p2, to: segB.p2 },
    { from: segA.p1, to: segB.p1 },
    { from: segA.p1, to: segB.p2 },
  ];
  let bestGap = Infinity;
  let gapFrom = null;
  let gapTo = null;
  for (const ep of endpoints) {
    const d = Math.hypot(ep.from.x - ep.to.x, ep.from.y - ep.to.y);
    if (d < bestGap) {
      bestGap = d;
      gapFrom = ep.from;
      gapTo = ep.to;
    }
  }

  // If overlapping or touching, always chain
  if (bestGap <= perpTol) return true;

  // 4. Sample pixels along the gap line and check dark ratio
  const numSamples = Math.max(5, Math.round(bestGap / 3));
  let darkCount = 0;
  let totalCount = 0;
  const halfBand = Math.max(2, Math.round(perpTol / 3));

  for (let s = 0; s < numSamples; s++) {
    const t = (s + 0.5) / numSamples;
    const cx = Math.round(gapFrom.x + (gapTo.x - gapFrom.x) * t);
    const cy = Math.round(gapFrom.y + (gapTo.y - gapFrom.y) * t);

    // Sample a small band perpendicular to the gap direction
    const gdx = gapTo.x - gapFrom.x;
    const gdy = gapTo.y - gapFrom.y;
    const glen = Math.sqrt(gdx * gdx + gdy * gdy);
    const nx = glen > 0 ? -gdy / glen : 0;
    const ny = glen > 0 ? gdx / glen : 1;

    for (let d = -halfBand; d <= halfBand; d++) {
      const px = Math.round(cx + nx * d);
      const py = Math.round(cy + ny * d);
      if (px >= 0 && px < w && py >= 0 && py < h) {
        totalCount++;
        if (mask[py * w + px]) darkCount++;
      }
    }
  }

  const darkRatio = totalCount > 0 ? darkCount / totalCount : 0;
  return darkRatio >= darkThreshold;
}

/**
 * Morphological skeletonization using iterative erosion + subtraction.
 * Much faster than pure-JS Zhang-Suen for large images.
 */
function _morphologicalSkeleton(binaryMat) {
  const skeleton = cv.Mat.zeros(binaryMat.rows, binaryMat.cols, cv.CV_8UC1);
  const temp = new cv.Mat();
  const eroded = new cv.Mat();
  const element = cv.getStructuringElement(cv.MORPH_CROSS, new cv.Size(3, 3));
  let src = binaryMat.clone();

  let done = false;
  while (!done) {
    cv.erode(src, eroded, element);
    cv.dilate(eroded, temp, element);
    cv.subtract(src, temp, temp);
    cv.bitwise_or(skeleton, temp, skeleton);
    eroded.copyTo(src);

    if (cv.countNonZero(src) === 0) done = true;
  }

  src.delete();
  temp.delete();
  eroded.delete();
  element.delete();

  return skeleton;
}

/**
 * Merge nearby collinear segments.
 * Segments with same position (±tolerance) and overlapping/adjacent ranges are merged.
 */
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
    const samePosition =
      Math.abs(seg.position - current.position) <= positionTolerance;
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

/**
 * Filter out thick zones (solid fills, not wall lines).
 * Measures perpendicular extent and rejects segments with large extent.
 */
function _filterThickZones(segments, mask, w, h, axis, maxThickness) {
  return segments.filter((seg) => {
    const len = seg.end - seg.start;
    if (len < 3) return false;

    const numSamples = Math.min(5, Math.max(2, Math.floor(len / 10)));
    const extents = [];
    const symmetryRatios = [];

    for (let s = 0; s < numSamples; s++) {
      const t = seg.start + Math.round((s + 0.5) * (len / numSamples));
      let extentNeg = 0;
      let extentPos = 0;

      if (axis === "H") {
        for (let d = 1; d < 300; d++) {
          const py = seg.position - d;
          if (py < 0 || !mask[py * w + t]) break;
          extentNeg++;
        }
        for (let d = 1; d < 300; d++) {
          const py = seg.position + d;
          if (py >= h || !mask[py * w + t]) break;
          extentPos++;
        }
      } else {
        for (let d = 1; d < 300; d++) {
          const px = seg.position - d;
          if (px < 0 || !mask[t * w + px]) break;
          extentNeg++;
        }
        for (let d = 1; d < 300; d++) {
          const px = seg.position + d;
          if (px >= w || !mask[t * w + px]) break;
          extentPos++;
        }
      }

      extents.push(extentNeg + 1 + extentPos);
      const maxSide = Math.max(extentNeg, extentPos);
      const minSide = Math.min(extentNeg, extentPos);
      symmetryRatios.push(maxSide > 0 ? minSide / maxSide : 1);
    }

    extents.sort((a, b) => a - b);
    const median = extents[Math.floor(extents.length / 2)];
    if (median > maxThickness) return false;
    // Reject only if extremely short relative to thickness (noise artifacts)
    if (len < median * 1.5) return false;

    symmetryRatios.sort((a, b) => a - b);
    const medianSymmetry = symmetryRatios[Math.floor(symmetryRatios.length / 2)];
    if (medianSymmetry < 0.15) return false;

    return true;
  });
}

/**
 * Measure wall thickness for an H/V segment using the distance transform.
 * Samples multiple points along the segment and returns 2 × median(distTransform).
 */
function _measureThickness(seg, distMat, w, h) {
  const len = seg.end - seg.start;
  const numSamples = Math.min(20, Math.max(5, Math.floor(len / 5)));
  const samples = [];

  for (let s = 0; s < numSamples; s++) {
    const t = seg.start + Math.round((s + 0.5) * (len / numSamples));
    let px, py;
    if (seg.axis === "H") {
      px = Math.min(w - 1, Math.max(0, t));
      py = Math.min(h - 1, Math.max(0, seg.position));
    } else {
      px = Math.min(w - 1, Math.max(0, seg.position));
      py = Math.min(h - 1, Math.max(0, t));
    }
    const dist = distMat.floatAt(py, px);
    if (dist > 0) samples.push(dist);
  }

  if (samples.length === 0) return 2; // fallback minimum
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  return Math.max(2, median * 2);
}

/**
 * Measure wall thickness for a diagonal segment.
 */
function _measureThicknessDiagonal(seg, distMat, w, h) {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const numSamples = Math.min(20, Math.max(5, Math.floor(len / 5)));
  const samples = [];

  for (let s = 0; s < numSamples; s++) {
    const t = (s + 0.5) / numSamples;
    const px = Math.min(w - 1, Math.max(0, Math.round(seg.x1 + dx * t)));
    const py = Math.min(h - 1, Math.max(0, Math.round(seg.y1 + dy * t)));
    const dist = distMat.floatAt(py, px);
    if (dist > 0) samples.push(dist);
  }

  if (samples.length === 0) return 2;
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  return Math.max(2, median * 2);
}

/**
 * Snap horizontal segment endpoints to nearby vertical segments and vice versa.
 */
function _snapEndpoints(hSegments, vSegments, snapTolerance) {
  for (const h of hSegments) {
    for (const v of vSegments) {
      if (
        Math.abs(h.start - v.position) <= snapTolerance &&
        h.position >= v.start - snapTolerance &&
        h.position <= v.end + snapTolerance
      ) {
        h.start = v.position;
      }
      if (
        Math.abs(h.end - v.position) <= snapTolerance &&
        h.position >= v.start - snapTolerance &&
        h.position <= v.end + snapTolerance
      ) {
        h.end = v.position;
      }
    }
  }

  for (const v of vSegments) {
    for (const h of hSegments) {
      if (
        Math.abs(v.start - h.position) <= snapTolerance &&
        v.position >= h.start - snapTolerance &&
        v.position <= h.end + snapTolerance
      ) {
        v.start = h.position;
      }
      if (
        Math.abs(v.end - h.position) <= snapTolerance &&
        v.position >= h.start - snapTolerance &&
        v.position <= h.end + snapTolerance
      ) {
        v.end = h.position;
      }
    }
  }
}

/**
 * Split segments at L, T, X intersections.
 * Returns flat array of segments with axis/position/start/end.
 */
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
          result.push({
            axis: "H",
            position: seg.position,
            start: current,
            end: sp,
          });
        }
        current = sp;
      }
      if (seg.end > current + tolerance) {
        result.push({
          axis: "H",
          position: seg.position,
          start: current,
          end: seg.end,
        });
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
          result.push({
            axis: "V",
            position: seg.position,
            start: current,
            end: sp,
          });
        }
        current = sp;
      }
      if (seg.end > current + tolerance) {
        result.push({
          axis: "V",
          position: seg.position,
          start: current,
          end: seg.end,
        });
      }
    } else {
      result.push(seg);
    }
  }

  return result;
}

/**
 * Extend segment endpoints to reach nearby perpendicular segments.
 * If a horizontal segment's start/end is close to (but not touching)
 * a vertical segment, extend it to connect.
 */
function _extendEndpoints(hSegments, vSegments, extendTolerance) {
  for (const h of hSegments) {
    for (const v of vSegments) {
      // Check if h's position falls within v's range
      if (h.position < v.start - extendTolerance || h.position > v.end + extendTolerance) continue;

      // Extend h.start leftward to reach v
      const gapStart = h.start - v.position;
      if (gapStart > 0 && gapStart <= extendTolerance) {
        h.start = v.position;
      }
      // Extend h.end rightward to reach v
      const gapEnd = v.position - h.end;
      if (gapEnd > 0 && gapEnd <= extendTolerance) {
        h.end = v.position;
      }
    }
  }

  for (const v of vSegments) {
    for (const h of hSegments) {
      // Check if v's position falls within h's range
      if (v.position < h.start - extendTolerance || v.position > h.end + extendTolerance) continue;

      // Extend v.start upward to reach h
      const gapStart = v.start - h.position;
      if (gapStart > 0 && gapStart <= extendTolerance) {
        v.start = h.position;
      }
      // Extend v.end downward to reach h
      const gapEnd = h.position - v.end;
      if (gapEnd > 0 && gapEnd <= extendTolerance) {
        v.end = h.position;
      }
    }
  }
}

/**
 * After topology split, map thicknesses from the original segments
 * to the split sub-segments (each sub-segment inherits parent thickness).
 */
function _mapThicknessesAfterSplit(
  resolved,
  originalH,
  originalV,
  hThicknesses,
  vThicknesses
) {
  const result = [];

  for (const seg of resolved) {
    if (seg.axis === "H") {
      // Find original H segment that contains this sub-segment
      let found = false;
      for (let i = 0; i < originalH.length; i++) {
        const orig = originalH[i];
        if (
          orig.position === seg.position &&
          seg.start >= orig.start - 1 &&
          seg.end <= orig.end + 1
        ) {
          result.push(hThicknesses[i]);
          found = true;
          break;
        }
      }
      if (!found) result.push(2); // fallback
    } else {
      let found = false;
      for (let i = 0; i < originalV.length; i++) {
        const orig = originalV[i];
        if (
          orig.position === seg.position &&
          seg.start >= orig.start - 1 &&
          seg.end <= orig.end + 1
        ) {
          result.push(vThicknesses[i]);
          found = true;
          break;
        }
      }
      if (!found) result.push(2);
    }
  }

  return result;
}
