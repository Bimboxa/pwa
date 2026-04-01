/**
 * Worker handler for extracting wall geometry from a base map image
 * using polygon annotations (flood fill room contours) as masks.
 *
 * Pipeline:
 *   1. Load image
 *   2. Optional rotation of source image + re-threshold + rotate boundaries
 *   3. Create wall mask from flood fill boundaries (rooms=white, cuts=black, wall=dark outside rooms)
 *   4. Morphological cleanup
 *   5. Distance transform for thickness map
 *   6. Morphological skeletonization
 *   7. HoughLinesP to extract line segments
 *   8. Post-process: classify, grid snap, gap fill, topology, chain colinear
 *   9. Convert ROI coords back + rotate back
 *  10. Return polylines + thicknesses
 */
async function vectoriseWallsAsync({ msg, payload }) {
  try {
    const {
      imageUrl,
      boundaries = [],
      offsetAngle = 0,
      meterByPx = 0,
    } = payload;

    if (!imageUrl) throw new Error("imageUrl is required");
    if (!boundaries.length) throw new Error("boundaries are required");

    // ── 1. Load image ──────────────────────────────────────────────────
    const imageData = await loadImageDataFromUrl(imageUrl);
    let { width, height, data } = imageData;

    // ── 2. Optional rotation of SOURCE IMAGE ───────────────────────────
    const angleRad = (offsetAngle * Math.PI) / 180;
    let origCenterX, origCenterY;
    let workBoundaries = boundaries;

    if (offsetAngle !== 0) {
      origCenterX = width / 2;
      origCenterY = height / 2;

      const cosA = Math.abs(Math.cos(angleRad));
      const sinA = Math.abs(Math.sin(angleRad));
      const newWidth = Math.ceil(width * cosA + height * sinA);
      const newHeight = Math.ceil(width * sinA + height * cosA);
      const newCenterX = newWidth / 2;
      const newCenterY = newHeight / 2;

      const origCanvas = new OffscreenCanvas(width, height);
      const origCtx = origCanvas.getContext("2d");
      origCtx.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);

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

      // Re-threshold to eliminate interpolation blur
      const threshold = 160;
      for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        const b = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        const v = b < threshold ? 0 : 255;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
      }

      // Rotate boundary polygons and their cuts
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
    const BINARY_THRESHOLD = 128;

    // 3a. Compute bounding box
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

    // 3b. ROI with padding
    const padding = meterByPx > 0 ? Math.round(0.5 / meterByPx) : 50;
    const roiX0 = Math.max(0, Math.floor(minX) - padding);
    const roiY0 = Math.max(0, Math.floor(minY) - padding);
    const roiX1 = Math.min(width - 1, Math.ceil(maxX) + padding);
    const roiY1 = Math.min(height - 1, Math.ceil(maxY) + padding);
    const roiW = roiX1 - roiX0 + 1;
    const roiH = roiY1 - roiY0 + 1;

    // 3c. Fill room polygons (white) then cuts (black) on canvas
    const maskCanvas = new OffscreenCanvas(roiW, roiH);
    const maskCtx = maskCanvas.getContext("2d");
    maskCtx.fillStyle = "#000000";
    maskCtx.fillRect(0, 0, roiW, roiH);

    maskCtx.fillStyle = "#ffffff";
    for (const boundary of workBoundaries) {
      const pts = boundary.points;
      if (!pts || pts.length < 3) continue;
      maskCtx.beginPath();
      maskCtx.moveTo(pts[0].x - roiX0, pts[0].y - roiY0);
      for (let i = 1; i < pts.length; i++) maskCtx.lineTo(pts[i].x - roiX0, pts[i].y - roiY0);
      maskCtx.closePath();
      maskCtx.fill();
    }

    // Cuts = holes in rooms = wall/pillar areas
    maskCtx.fillStyle = "#000000";
    for (const boundary of workBoundaries) {
      const cuts = boundary.cuts;
      if (!cuts || cuts.length === 0) continue;
      for (const cut of cuts) {
        const pts = cut.points;
        if (!pts || pts.length < 3) continue;
        maskCtx.beginPath();
        maskCtx.moveTo(pts[0].x - roiX0, pts[0].y - roiY0);
        for (let i = 1; i < pts.length; i++) maskCtx.lineTo(pts[i].x - roiX0, pts[i].y - roiY0);
        maskCtx.closePath();
        maskCtx.fill();
      }
    }

    const maskImageData = maskCtx.getImageData(0, 0, roiW, roiH);

    // 3d. wallMask = NOT room AND dark on image
    const wWidth = roiW;
    const wHeight = roiH;
    const wWallMask = new Uint8Array(wWidth * wHeight);
    for (let i = 0; i < wWidth * wHeight; i++) {
      const isRoom = maskImageData.data[i * 4] > 128;
      if (isRoom) { wWallMask[i] = 0; continue; }
      const imgX = (i % wWidth) + roiX0;
      const imgY = Math.floor(i / wWidth) + roiY0;
      const imgIdx = (imgY * width + imgX) * 4;
      const brightness = data[imgIdx] * 0.299 + data[imgIdx + 1] * 0.587 + data[imgIdx + 2] * 0.114;
      wWallMask[i] = brightness < BINARY_THRESHOLD ? 1 : 0;
    }

    // ── 4. Build OpenCV Mat + morphological cleanup ─────────────────────
    const wallMat = new cv.Mat(wHeight, wWidth, cv.CV_8UC1);
    for (let i = 0; i < wWidth * wHeight; i++) wallMat.data[i] = wWallMask[i] ? 255 : 0;

    const closeKernelSize = meterByPx > 0 ? Math.max(3, Math.round(0.01 / meterByPx)) : 3;
    const closeKernel = cv.Mat.ones(closeKernelSize, closeKernelSize, cv.CV_8U);
    cv.morphologyEx(wallMat, wallMat, cv.MORPH_CLOSE, closeKernel);
    closeKernel.delete();

    const openKernel = cv.Mat.ones(2, 2, cv.CV_8U);
    cv.morphologyEx(wallMat, wallMat, cv.MORPH_OPEN, openKernel);
    openKernel.delete();

    // ── 5. Distance transform ──────────────────────────────────────────
    const distMat = new cv.Mat();
    cv.distanceTransform(wallMat, distMat, cv.DIST_L2, 3);

    // ── 6. Morphological skeletonization ───────────────────────────────
    const skeleton = _morphologicalSkeleton(wallMat);

    // ── 7. HoughLinesP ─────────────────────────────────────────────────
    const minLineLength = meterByPx > 0 ? Math.max(10, Math.round(0.05 / meterByPx)) : 10;
    const maxLineGap = meterByPx > 0 ? Math.max(3, Math.round(0.02 / meterByPx)) : 5;

    const lines = new cv.Mat();
    cv.HoughLinesP(skeleton, lines, 1, Math.PI / 180, 20, minLineLength, maxLineGap);

    let rawSegments = [];
    for (let i = 0; i < lines.rows; i++) {
      rawSegments.push({
        x1: lines.data32S[i * 4], y1: lines.data32S[i * 4 + 1],
        x2: lines.data32S[i * 4 + 2], y2: lines.data32S[i * 4 + 3],
      });
    }

    // ── 8. Post-process ────────────────────────────────────────────────
    const postResult = _postProcessSegments(rawSegments, {
      wWallMask, wWidth, wHeight, distMat, meterByPx, maxLineGap,
    });
    let polylines = postResult.polylines;
    let thicknesses = postResult.thicknesses;

    // ── 9. Convert ROI coords back + rotate back ───────────────────────
    polylines = polylines.map((pl) => pl.map((p) => ({ x: p.x + roiX0, y: p.y + roiY0 })));

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

    // Cleanup
    wallMat.delete(); distMat.delete(); skeleton.delete(); lines.delete();

    postMessage({ msg, payload: { polylines, thicknesses } });
  } catch (err) {
    postMessage({ msg, error: err.message || String(err) });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Post-processing pipeline
// ═══════════════════════════════════════════════════════════════════════

function _postProcessSegments(rawSegments, ctx) {
  const { wWallMask, wWidth, wHeight, distMat, meterByPx, maxLineGap } = ctx;

  // ── Phase 1: Classify H/V/diagonal, merge collinear ──────────────────
  const ANGLE_TOL = Math.PI / 12;
  const hSegments = [], vSegments = [], diagonalSegments = [];

  for (const seg of rawSegments) {
    const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
    const angle = Math.atan2(Math.abs(dy), Math.abs(dx));
    if (angle < ANGLE_TOL) {
      hSegments.push({ axis: "H", position: Math.round((seg.y1 + seg.y2) / 2), start: Math.min(seg.x1, seg.x2), end: Math.max(seg.x1, seg.x2) });
    } else if (angle > Math.PI / 2 - ANGLE_TOL) {
      vSegments.push({ axis: "V", position: Math.round((seg.x1 + seg.x2) / 2), start: Math.min(seg.y1, seg.y2), end: Math.max(seg.y1, seg.y2) });
    } else {
      diagonalSegments.push(seg);
    }
  }

  // Filter short segments — skeleton noise at junctions.
  // Real walls are > 10cm. Short H/V fragments at junctions are noise.
  // Diagonals use a higher threshold (30cm) since real diagonals are rare on plans.
  const minWallLen = meterByPx > 0 ? Math.round(0.10 / meterByPx) : 15;
  const minDiagonalLen = meterByPx > 0 ? Math.round(0.50 / meterByPx) : 70;

  const filterByLen = (segs, minLen) => {
    const filtered = [];
    for (const seg of segs) {
      const len = seg.end !== undefined ? (seg.end - seg.start) : Math.sqrt((seg.x2 - seg.x1) ** 2 + (seg.y2 - seg.y1) ** 2);
      if (len >= minLen) filtered.push(seg);
    }
    return filtered;
  };

  hSegments.splice(0, hSegments.length, ...filterByLen(hSegments, minWallLen));
  vSegments.splice(0, vSegments.length, ...filterByLen(vSegments, minWallLen));
  diagonalSegments.splice(0, diagonalSegments.length, ...filterByLen(diagonalSegments, minDiagonalLen));

  const posTolerance = meterByPx > 0 ? Math.max(3, Math.round(0.03 / meterByPx)) : 5;
  const gapTolerance = meterByPx > 0 ? Math.max(maxLineGap * 2, Math.round(0.10 / meterByPx)) : maxLineGap * 3;

  let mergedH = _mergeColinear(hSegments, posTolerance, gapTolerance);
  let mergedV = _mergeColinear(vSegments, posTolerance, gapTolerance);

  const maxThickness = meterByPx > 0 ? Math.round(0.80 / meterByPx) : 120;
  mergedH = _filterThickZones(mergedH, wWallMask, wWidth, wHeight, "H", maxThickness);
  mergedV = _filterThickZones(mergedV, wWallMask, wWidth, wHeight, "V", maxThickness);

  // ── Phase 2: Grid snap ───────────────────────────────────────────────
  const gridTolerance = meterByPx > 0 ? Math.max(3, Math.round(0.02 / meterByPx)) : 4;
  const hGridLines = _buildGridLines(mergedH.map((s) => s.position), gridTolerance);
  const vGridLines = _buildGridLines(mergedV.map((s) => s.position), gridTolerance);
  for (const seg of mergedH) seg.position = _snapToGrid(seg.position, hGridLines);
  for (const seg of mergedV) seg.position = _snapToGrid(seg.position, vGridLines);
  mergedH = _mergeColinear(mergedH, 1, gapTolerance);
  mergedV = _mergeColinear(mergedV, 1, gapTolerance);

  // ── Phase 3: Gap fill (dark pixel check) ─────────────────────────────
  const gapFillMaxDistance = meterByPx > 0 ? Math.round(0.30 / meterByPx) : 40;
  mergedH = _fillGapsOnGridLines(mergedH, wWallMask, wWidth, wHeight, "H", gapFillMaxDistance, distMat);
  mergedV = _fillGapsOnGridLines(mergedV, wWallMask, wWidth, wHeight, "V", gapFillMaxDistance, distMat);

  // ── Phase 4: Thickness, snap, extend, topology ───────────────────────
  const hThicknesses = mergedH.map((seg) => _measureThickness(seg, distMat, wWidth, wHeight));
  const vThicknesses = mergedV.map((seg) => _measureThickness(seg, distMat, wWidth, wHeight));

  const snapTolerance = meterByPx > 0 ? Math.max(5, Math.round(0.05 / meterByPx)) : 8;
  _snapEndpoints(mergedH, mergedV, snapTolerance);
  const extendTolerance = meterByPx > 0 ? Math.max(8, Math.round(0.15 / meterByPx)) : 15;
  _extendEndpoints(mergedH, mergedV, extendTolerance, wWallMask, wWidth, wHeight);

  const resolved = _resolveTopology(mergedH, mergedV, snapTolerance);
  const resolvedThicknesses = _mapThicknessesAfterSplit(resolved, mergedH, mergedV, hThicknesses, vThicknesses);

  // Convert to endpoint pairs
  const allEndpointPairs = [];
  const allPairThicknesses = [];
  for (let i = 0; i < resolved.length; i++) {
    const seg = resolved[i];
    if (seg.axis === "H") {
      allEndpointPairs.push({ p1: { x: seg.start, y: seg.position }, p2: { x: seg.end, y: seg.position } });
    } else {
      allEndpointPairs.push({ p1: { x: seg.position, y: seg.start }, p2: { x: seg.position, y: seg.end } });
    }
    allPairThicknesses.push(resolvedThicknesses[i]);
  }
  for (const seg of diagonalSegments) {
    allEndpointPairs.push({ p1: { x: seg.x1, y: seg.y1 }, p2: { x: seg.x2, y: seg.y2 } });
    allPairThicknesses.push(_measureThicknessDiagonal(seg, distMat, wWidth, wHeight));
  }

  // ── Phase 5: Chain colinear segments (dark pixel continuity) ─────────
  const colinearDistTol = meterByPx > 0 ? Math.max(5, Math.round(0.05 / meterByPx)) : 8;
  const darkThreshold = 0.4;
  const chainResult = _chainColinearSegments(allEndpointPairs, allPairThicknesses, colinearDistTol, darkThreshold, wWallMask, wWidth, wHeight);

  // ── Phase 5b: Fill endpoint gaps (junction connectors) ──────────────
  const gapMaxDist = meterByPx > 0 ? Math.max(10, Math.round(0.30 / meterByPx)) : 30;
  const gapResult = _fillEndpointGaps(
    chainResult.polylines, chainResult.thicknesses,
    gapMaxDist, wWallMask, wWidth, wHeight, distMat, 0
  );

  // ── Phase 5c: Remove junction noise ─────────────────────────────────
  // Short segments (< 40cm) whose BOTH endpoints are near the body of
  // longer segments are skeleton artifacts at L/T/X junctions.
  // Also catches diagonal segments created by gap fill (Phase 5b).
  const junctionNoiseMaxLen = meterByPx > 0 ? Math.round(0.40 / meterByPx) : 60;
  // Snap distance ~ wall thickness (typically 20-30cm on plans)
  const junctionSnapDist = meterByPx > 0 ? Math.max(15, Math.round(0.25 / meterByPx)) : 40;
  const cleanResult = _removeJunctionNoise(
    gapResult.polylines, gapResult.thicknesses, junctionNoiseMaxLen, junctionSnapDist
  );

  // ── Phase 6: Simplify polylines on grid lines ────────────────────────
  // Remove intermediate points that lie on the same grid line,
  // keeping only extremities and junction points (shared with other polylines).
  const allGridLines = { h: hGridLines, v: vGridLines };
  const simplified = _simplifyPolylinesOnGrid(
    cleanResult.polylines, allGridLines, gridTolerance, wWallMask, wWidth, wHeight
  );

  return { polylines: simplified, thicknesses: cleanResult.thicknesses };
}

// ═══════════════════════════════════════════════════════════════════════
// Grid simplification
// ═══════════════════════════════════════════════════════════════════════

/**
 * Simplify polylines by removing intermediate points that lie on the same
 * grid line. Keep only:
 * - First and last point of the polyline
 * - Points that are junctions (shared by multiple polylines)
 * - Points where the grid line changes (direction change)
 */
function _simplifyPolylinesOnGrid(polylines, gridLines, gridTol, mask, w, h) {
  // 1. Build a set of junction points (points that appear in multiple polylines)
  const pointKeyMap = new Map();
  const pointKey = (p) => `${Math.round(p.x)},${Math.round(p.y)}`;

  for (const pl of polylines) {
    for (const p of pl) {
      const key = pointKey(p);
      pointKeyMap.set(key, (pointKeyMap.get(key) || 0) + 1);
    }
  }

  const junctionKeys = new Set();
  for (const [key, count] of pointKeyMap) {
    if (count > 1) junctionKeys.add(key);
  }

  // 2. For each polyline, determine which grid line each point belongs to
  const findGridLine = (coord, lines) => {
    for (const line of lines) {
      if (Math.abs(coord - line) <= gridTol) return line;
    }
    return null;
  };

  const isSegmentDark = (pA, pB) => _isSegmentOnWall(pA, pB, mask, w, h);

  return polylines.map((pl) => {
    if (pl.length <= 2) return pl;

    const result = [pl[0]];

    for (let i = 1; i < pl.length - 1; i++) {
      const prev = result[result.length - 1]; // use last kept point
      const curr = pl[i];
      const next = pl[i + 1];

      // Keep if it's a junction point
      if (junctionKeys.has(pointKey(curr))) {
        result.push(curr);
        continue;
      }

      // Check if prev→curr→next are on the same grid line
      let onSameGrid = false;

      const prevHGrid = findGridLine(prev.y, gridLines.h);
      const currHGrid = findGridLine(curr.y, gridLines.h);
      const nextHGrid = findGridLine(next.y, gridLines.h);
      if (prevHGrid !== null && currHGrid !== null && nextHGrid !== null &&
          prevHGrid === currHGrid && currHGrid === nextHGrid) {
        onSameGrid = true;
      }

      if (!onSameGrid) {
        const prevVGrid = findGridLine(prev.x, gridLines.v);
        const currVGrid = findGridLine(curr.x, gridLines.v);
        const nextVGrid = findGridLine(next.x, gridLines.v);
        if (prevVGrid !== null && currVGrid !== null && nextVGrid !== null &&
            prevVGrid === currVGrid && currVGrid === nextVGrid) {
          onSameGrid = true;
        }
      }

      if (onSameGrid) {
        // Only skip if the shortcut prev→next passes through dark pixels
        if (isSegmentDark(prev, next)) {
          continue; // safe to skip — wall is continuous
        }
      }

      // Keep the point
      result.push(curr);
    }

    result.push(pl[pl.length - 1]);
    return result;
  });
}

// ═══════════════════════════════════════════════════════════════════════
// White gap splitting
// ═══════════════════════════════════════════════════════════════════════

/**
 * Split polylines wherever a segment between consecutive points
 * crosses mostly white (non-wall) pixels.
 * This prevents ghost lines across empty areas.
 */
function _splitPolylinesAtWhiteGaps(polylines, thicknesses, mask, w, h) {
  const resultPolylines = [];
  const resultThicknesses = [];

  for (let pi = 0; pi < polylines.length; pi++) {
    const pl = polylines[pi];
    const thickness = thicknesses[pi];

    if (pl.length < 2) continue;

    let currentChain = [pl[0]];

    for (let i = 1; i < pl.length; i++) {
      const prev = pl[i - 1];
      const curr = pl[i];

      if (_isSegmentOnWall(prev, curr, mask, w, h)) {
        currentChain.push(curr);
      } else {
        // Cut here — save current chain if valid
        if (currentChain.length >= 2) {
          resultPolylines.push(currentChain);
          resultThicknesses.push(thickness);
        }
        // Start new chain from current point
        currentChain = [curr];
      }
    }

    // Save last chain
    if (currentChain.length >= 2) {
      resultPolylines.push(currentChain);
      resultThicknesses.push(thickness);
    }
  }

  return { polylines: resultPolylines, thicknesses: resultThicknesses };
}

/**
 * Check if a segment between two points passes through wall pixels.
 * Splits the segment into chunks (~20px each) and checks each chunk.
 * If ANY chunk has < 30% dark pixels, the segment is invalid.
 * This catches long segments that are dark at the ends but white in the middle.
 */
function _isSegmentOnWall(pA, pB, mask, w, h) {
  const dx = pB.x - pA.x, dy = pB.y - pA.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 3) return true;

  // Split into chunks of ~20px
  const chunkLen = 20;
  const numChunks = Math.max(1, Math.round(len / chunkLen));

  for (let c = 0; c < numChunks; c++) {
    const t0 = c / numChunks;
    const t1 = (c + 1) / numChunks;
    let darkCount = 0, totalCount = 0;

    // Sample 5 points per chunk
    for (let s = 0; s < 5; s++) {
      const t = t0 + (s + 0.5) / 5 * (t1 - t0);
      const px = Math.round(pA.x + dx * t);
      const py = Math.round(pA.y + dy * t);
      if (px >= 0 && px < w && py >= 0 && py < h) {
        totalCount++;
        if (mask[py * w + px]) darkCount++;
      }
    }

    // If this chunk is mostly white, segment is invalid
    if (totalCount > 0 && darkCount / totalCount < 0.3) {
      return false;
    }
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 5b: Endpoint gap fill
// ═══════════════════════════════════════════════════════════════════════

/**
 * Check if a gap between two points passes through dark pixels.
 * Same chunk logic as _isSegmentOnWall but samples a perpendicular band
 * (±halfBand px) for robustness at junctions.
 */
function _isGapDark(pA, pB, mask, w, h) {
  const dx = pB.x - pA.x, dy = pB.y - pA.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 3) return true;

  const chunkLen = 20;
  const numChunks = Math.max(1, Math.round(len / chunkLen));
  // Perpendicular direction
  const nx = len > 0 ? -dy / len : 0;
  const ny = len > 0 ? dx / len : 1;
  const halfBand = 3;

  for (let c = 0; c < numChunks; c++) {
    const t0 = c / numChunks;
    const t1 = (c + 1) / numChunks;
    let darkCount = 0, totalCount = 0;

    for (let s = 0; s < 5; s++) {
      const t = t0 + (s + 0.5) / 5 * (t1 - t0);
      const cx = pA.x + dx * t;
      const cy = pA.y + dy * t;
      for (let d = -halfBand; d <= halfBand; d++) {
        const px = Math.round(cx + nx * d);
        const py = Math.round(cy + ny * d);
        if (px >= 0 && px < w && py >= 0 && py < h) {
          totalCount++;
          if (mask[py * w + px]) darkCount++;
        }
      }
    }

    if (totalCount > 0 && darkCount / totalCount < 0.3) {
      return false;
    }
  }

  return true;
}

/**
 * Analyze the dark pixel zone in a gap to determine the real wall orientation
 * and thickness, rather than blindly connecting endpoints.
 *
 * Returns { p1, p2, thickness } or null if no valid wall found.
 */
function _analyzeGapWall(pA, pB, mask, w, h, distMat, orthoAngle) {
  const gdx = pB.x - pA.x, gdy = pB.y - pA.y;
  const gapLen = Math.sqrt(gdx * gdx + gdy * gdy);
  if (gapLen < 3) return null;

  // 1. Extract dark pixels in the ROI around the gap
  const padding = 15;
  const minX = Math.max(0, Math.floor(Math.min(pA.x, pB.x) - padding));
  const minY = Math.max(0, Math.floor(Math.min(pA.y, pB.y) - padding));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(pA.x, pB.x) + padding));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(pA.y, pB.y) + padding));

  // Collect dark pixel positions
  const darkPixels = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (mask[y * w + x]) {
        darkPixels.push({ x, y });
      }
    }
  }

  if (darkPixels.length < 5) return null;

  // 2. Determine orientation using image moments
  let sumX = 0, sumY = 0;
  for (const p of darkPixels) { sumX += p.x; sumY += p.y; }
  const cx = sumX / darkPixels.length;
  const cy = sumY / darkPixels.length;

  // Covariance matrix
  let mXX = 0, mXY = 0, mYY = 0;
  for (const p of darkPixels) {
    const dx = p.x - cx, dy = p.y - cy;
    mXX += dx * dx;
    mXY += dx * dy;
    mYY += dy * dy;
  }

  // Principal axis angle from covariance
  const rawAngle = 0.5 * Math.atan2(2 * mXY, mXX - mYY);

  // 3. Snap to nearest ortho direction (H or V relative to orthoAngle)
  const orthoRad = (orthoAngle || 0) * Math.PI / 180;
  const candidates = [orthoRad, orthoRad + Math.PI / 2];
  const SNAP_TOL = Math.PI / 12; // 15°

  let snappedAngle = null;
  for (const ca of candidates) {
    // Normalize angle difference to [-PI/2, PI/2]
    let diff = rawAngle - ca;
    while (diff > Math.PI / 2) diff -= Math.PI;
    while (diff < -Math.PI / 2) diff += Math.PI;
    if (Math.abs(diff) < SNAP_TOL) {
      snappedAngle = ca;
      break;
    }
  }

  // Reject gap if orientation doesn't snap to H or V — diagonal gaps are
  // always skeleton noise at corners, never real walls on architectural plans.
  if (snappedAngle === null) return null;

  // 4. Project endpoints onto the principal axis to get segment extent
  const cosA = Math.cos(snappedAngle), sinA = Math.sin(snappedAngle);

  // Project pA and pB onto the axis
  const projA = (pA.x - cx) * cosA + (pA.y - cy) * sinA;
  const projB = (pB.x - cx) * cosA + (pB.y - cy) * sinA;
  const tMin = Math.min(projA, projB);
  const tMax = Math.max(projA, projB);

  // Reconstruct p1 and p2 along the axis through the centroid
  const p1 = { x: cx + tMin * cosA, y: cy + tMin * sinA };
  const p2 = { x: cx + tMax * cosA, y: cy + tMax * sinA };

  // 5. Validate with dark pixel check along the computed segment
  if (!_isGapDark(p1, p2, mask, w, h)) return null;

  // 6. Measure thickness from distMap
  const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
  const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
  const numSamples = Math.min(20, Math.max(5, Math.floor(segLen / 5)));
  const samples = [];
  for (let s = 0; s < numSamples; s++) {
    const t = (s + 0.5) / numSamples;
    const px = Math.min(w - 1, Math.max(0, Math.round(p1.x + segDx * t)));
    const py = Math.min(h - 1, Math.max(0, Math.round(p1.y + segDy * t)));
    const dist = distMat.floatAt(py, px);
    if (dist > 0) samples.push(dist);
  }
  if (samples.length === 0) return null;
  samples.sort((a, b) => a - b);
  const thickness = Math.max(2, samples[Math.floor(samples.length / 2)] * 2);

  return { p1, p2, thickness };
}

/**
 * Phase 5b: Fill gaps between close polyline endpoints.
 *
 * For each pair of endpoints from different polylines that are close enough,
 * analyze the dark pixels between them to create a connecting segment with
 * the correct orientation and thickness.
 */
function _fillEndpointGaps(polylines, thicknesses, maxDist, mask, w, h, distMat, orthoAngle) {
  // Collect all endpoints: { polyIndex, endIndex (0=first, 1=last), point }
  const endpoints = [];
  for (let i = 0; i < polylines.length; i++) {
    const pl = polylines[i];
    if (pl.length < 2) continue;
    endpoints.push({ pi: i, ei: 0, pt: pl[0] });
    endpoints.push({ pi: i, ei: 1, pt: pl[pl.length - 1] });
  }

  const newPolylines = [];
  const newThicknesses = [];
  const usedPairs = new Set();

  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i + 1; j < endpoints.length; j++) {
      const a = endpoints[i], b = endpoints[j];

      // Skip if same polyline
      if (a.pi === b.pi) continue;

      // Skip if already used this pair
      const pairKey = `${Math.min(a.pi, b.pi)}_${Math.max(a.pi, b.pi)}_${a.ei}_${b.ei}`;
      if (usedPairs.has(pairKey)) continue;

      // Check distance
      const dx = a.pt.x - b.pt.x, dy = a.pt.y - b.pt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxDist || dist < 3) continue;

      // Analyze the gap
      const result = _analyzeGapWall(a.pt, b.pt, mask, w, h, distMat, orthoAngle);
      if (!result) continue;

      // Create new polyline for the gap segment
      newPolylines.push([result.p1, result.p2]);
      newThicknesses.push(result.thickness);
      usedPairs.add(pairKey);
    }
  }

  return {
    polylines: [...polylines, ...newPolylines],
    thicknesses: [...thicknesses, ...newThicknesses],
  };
}


// ═══════════════════════════════════════════════════════════════════════
// Phase 5c: Junction noise removal
// ═══════════════════════════════════════════════════════════════════════

/**
 * Remove short polylines that are skeleton noise at junctions.
 * A polyline is noise if ALL of these are true:
 * 1. It has exactly 2 points (single segment)
 * 2. Its length < maxLen (30cm — covers all junction artifacts)
 * 3. BOTH endpoints are within snapDist of OTHER, longer polylines
 *    (checked against the full body of the polyline, not just endpoints)
 *    (the other polyline must be at least 3× longer)
 */
function _removeJunctionNoise(polylines, thicknesses, maxLen, snapDist) {
  // Point-to-segment distance
  const ptSegDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const projX = ax + t * dx, projY = ay + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  };

  // Distance from point to nearest segment of a polyline
  const ptPolyDist = (px, py, pl) => {
    let minD = Infinity;
    for (let k = 0; k < pl.length - 1; k++) {
      const d = ptSegDist(px, py, pl[k].x, pl[k].y, pl[k + 1].x, pl[k + 1].y);
      if (d < minD) minD = d;
    }
    return minD;
  };

  const lengths = polylines.map((pl) => {
    if (pl.length < 2) return 0;
    let len = 0;
    for (let i = 1; i < pl.length; i++) {
      const dx = pl[i].x - pl[i - 1].x, dy = pl[i].y - pl[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  });

  const keep = new Array(polylines.length).fill(true);

  for (let i = 0; i < polylines.length; i++) {
    const pl = polylines[i];
    if (pl.length !== 2) continue;

    const pStart = pl[0];
    const pEnd = pl[1];

    // Determine if segment is diagonal (neither H nor V)
    const segDx = Math.abs(pEnd.x - pStart.x);
    const segDy = Math.abs(pEnd.y - pStart.y);
    const isDiagonal = segDx > 0.2 * segDy && segDy > 0.2 * segDx;

    // Diagonals get a larger maxLen (0.70m) since they're almost never real walls
    // H/V keep the stricter maxLen (0.40m) to protect real short wall segments
    const effectiveMaxLen = isDiagonal ? Math.round(maxLen * 1.75) : maxLen;
    if (lengths[i] >= effectiveMaxLen) continue;

    const minLongLen = lengths[i] * 3;

    let startNearLong = false;
    let endNearLong = false;

    for (let j = 0; j < polylines.length; j++) {
      if (j === i) continue;
      if (lengths[j] < minLongLen) continue;

      const other = polylines[j];

      if (!startNearLong) {
        if (ptPolyDist(pStart.x, pStart.y, other) <= snapDist) startNearLong = true;
      }

      if (!endNearLong) {
        if (ptPolyDist(pEnd.x, pEnd.y, other) <= snapDist) endNearLong = true;
      }

      if (startNearLong && endNearLong) break;
    }

    if (isDiagonal) {
      // Diagonal: only need ONE endpoint near a long wall — a diagonal
      // with one end near a wall is always junction skeleton noise
      if (startNearLong || endNearLong) {
        keep[i] = false;
      }
    } else {
      // H/V: need BOTH endpoints near long walls (conservative)
      if (startNearLong && endNearLong) {
        keep[i] = false;
      }
    }
  }

  return {
    polylines: polylines.filter((_, i) => keep[i]),
    thicknesses: thicknesses.filter((_, i) => keep[i]),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════════════════════════

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
  src.delete(); temp.delete(); eroded.delete(); element.delete();
  return skeleton;
}

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
    if (Math.abs(seg.position - current.position) <= positionTolerance && seg.start <= current.end + gapTolerance) {
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

function _filterThickZones(segments, mask, w, h, axis, maxThickness) {
  return segments.filter((seg) => {
    const len = seg.end - seg.start;
    if (len < 3) return false;
    const numSamples = Math.min(5, Math.max(2, Math.floor(len / 10)));
    const extents = [], symmetryRatios = [];
    for (let s = 0; s < numSamples; s++) {
      const t = seg.start + Math.round((s + 0.5) * (len / numSamples));
      let extentNeg = 0, extentPos = 0;
      if (axis === "H") {
        for (let d = 1; d < 300; d++) { const py = seg.position - d; if (py < 0 || !mask[py * w + t]) break; extentNeg++; }
        for (let d = 1; d < 300; d++) { const py = seg.position + d; if (py >= h || !mask[py * w + t]) break; extentPos++; }
      } else {
        for (let d = 1; d < 300; d++) { const px = seg.position - d; if (px < 0 || !mask[t * w + px]) break; extentNeg++; }
        for (let d = 1; d < 300; d++) { const px = seg.position + d; if (px >= w || !mask[t * w + px]) break; extentPos++; }
      }
      extents.push(extentNeg + 1 + extentPos);
      const maxSide = Math.max(extentNeg, extentPos), minSide = Math.min(extentNeg, extentPos);
      symmetryRatios.push(maxSide > 0 ? minSide / maxSide : 1);
    }
    extents.sort((a, b) => a - b);
    const median = extents[Math.floor(extents.length / 2)];
    if (median > maxThickness) return false;
    if (len < median * 1.5) return false;
    symmetryRatios.sort((a, b) => a - b);
    if (symmetryRatios[Math.floor(symmetryRatios.length / 2)] < 0.15) return false;
    return true;
  });
}

function _measureThickness(seg, distMat, w, h) {
  const len = seg.end - seg.start;
  const numSamples = Math.min(20, Math.max(5, Math.floor(len / 5)));
  const samples = [];
  for (let s = 0; s < numSamples; s++) {
    const t = seg.start + Math.round((s + 0.5) * (len / numSamples));
    let px, py;
    if (seg.axis === "H") { px = Math.min(w - 1, Math.max(0, t)); py = Math.min(h - 1, Math.max(0, seg.position)); }
    else { px = Math.min(w - 1, Math.max(0, seg.position)); py = Math.min(h - 1, Math.max(0, t)); }
    const dist = distMat.floatAt(py, px);
    if (dist > 0) samples.push(dist);
  }
  if (samples.length === 0) return 2;
  samples.sort((a, b) => a - b);
  return Math.max(2, samples[Math.floor(samples.length / 2)] * 2);
}

function _measureThicknessDiagonal(seg, distMat, w, h) {
  const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
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
  return Math.max(2, samples[Math.floor(samples.length / 2)] * 2);
}

function _buildGridLines(positions, tolerance) {
  if (positions.length === 0) return [];
  const sorted = [...positions].sort((a, b) => a - b);
  const lines = [];
  let clusterSum = sorted[0], clusterCount = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= tolerance) {
      clusterSum += sorted[i]; clusterCount++;
    } else {
      lines.push(Math.round(clusterSum / clusterCount));
      clusterSum = sorted[i]; clusterCount = 1;
    }
  }
  lines.push(Math.round(clusterSum / clusterCount));
  return lines;
}

function _snapToGrid(position, gridLines) {
  let bestDist = Infinity, bestLine = position;
  for (const line of gridLines) {
    const dist = Math.abs(position - line);
    if (dist < bestDist) { bestDist = dist; bestLine = line; }
  }
  return bestLine;
}

function _fillGapsOnGridLines(segments, mask, w, h, axis, maxGap, distMat) {
  const byPosition = new Map();
  for (const seg of segments) {
    if (!byPosition.has(seg.position)) byPosition.set(seg.position, []);
    byPosition.get(seg.position).push(seg);
  }
  const result = [];
  for (const [position, segs] of byPosition) {
    segs.sort((a, b) => a.start - b.start);
    const merged = [{ ...segs[0] }];
    for (let i = 1; i < segs.length; i++) {
      const prev = merged[merged.length - 1], curr = segs[i];
      const gap = curr.start - prev.end;
      if (gap <= 0) { prev.end = Math.max(prev.end, curr.end); }
      else if (gap <= maxGap && _measureDarkRatio(position, prev.end, curr.start, mask, w, h, axis) > 0.5) {
        prev.end = curr.end;
      } else { merged.push({ ...curr }); }
    }
    result.push(...merged);
  }
  return result;
}

function _measureDarkRatio(position, start, end, mask, w, h, axis) {
  let darkCount = 0, totalCount = 0;
  for (let t = Math.round(start); t <= Math.round(end); t++) {
    for (let d = -3; d <= 3; d++) {
      let px, py;
      if (axis === "H") { px = t; py = position + d; } else { px = position + d; py = t; }
      if (px < 0 || px >= w || py < 0 || py >= h) continue;
      totalCount++;
      if (mask[py * w + px]) darkCount++;
    }
  }
  return totalCount > 0 ? darkCount / totalCount : 0;
}

function _snapEndpoints(hSegments, vSegments, snapTolerance) {
  for (const h of hSegments) {
    for (const v of vSegments) {
      if (Math.abs(h.start - v.position) <= snapTolerance && h.position >= v.start - snapTolerance && h.position <= v.end + snapTolerance) h.start = v.position;
      if (Math.abs(h.end - v.position) <= snapTolerance && h.position >= v.start - snapTolerance && h.position <= v.end + snapTolerance) h.end = v.position;
    }
  }
  for (const v of vSegments) {
    for (const h of hSegments) {
      if (Math.abs(v.start - h.position) <= snapTolerance && v.position >= h.start - snapTolerance && v.position <= h.end + snapTolerance) v.start = h.position;
      if (Math.abs(v.end - h.position) <= snapTolerance && v.position >= h.start - snapTolerance && v.position <= h.end + snapTolerance) v.end = h.position;
    }
  }
}

function _extendEndpoints(hSegments, vSegments, extendTolerance, mask, w, h) {
  const DARK_THRESHOLD = 0.4;
  for (const hs of hSegments) {
    for (const vs of vSegments) {
      if (hs.position < vs.start - extendTolerance || hs.position > vs.end + extendTolerance) continue;
      const gapStart = hs.start - vs.position;
      if (gapStart > 0 && gapStart <= extendTolerance) {
        if (_measureDarkRatio(hs.position, vs.position, hs.start, mask, w, h, "H") >= DARK_THRESHOLD) {
          hs.start = vs.position;
        }
      }
      const gapEnd = vs.position - hs.end;
      if (gapEnd > 0 && gapEnd <= extendTolerance) {
        if (_measureDarkRatio(hs.position, hs.end, vs.position, mask, w, h, "H") >= DARK_THRESHOLD) {
          hs.end = vs.position;
        }
      }
    }
  }
  for (const vs of vSegments) {
    for (const hs of hSegments) {
      if (vs.position < hs.start - extendTolerance || vs.position > hs.end + extendTolerance) continue;
      const gapStart = vs.start - hs.position;
      if (gapStart > 0 && gapStart <= extendTolerance) {
        if (_measureDarkRatio(vs.position, hs.position, vs.start, mask, w, h, "V") >= DARK_THRESHOLD) {
          vs.start = hs.position;
        }
      }
      const gapEnd = hs.position - vs.end;
      if (gapEnd > 0 && gapEnd <= extendTolerance) {
        if (_measureDarkRatio(vs.position, vs.end, hs.position, mask, w, h, "V") >= DARK_THRESHOLD) {
          vs.end = hs.position;
        }
      }
    }
  }
}

function _resolveTopology(hSegments, vSegments, tolerance) {
  const hSplitPoints = new Map(), vSplitPoints = new Map();
  for (let hi = 0; hi < hSegments.length; hi++) {
    const h = hSegments[hi];
    for (let vi = 0; vi < vSegments.length; vi++) {
      const v = vSegments[vi];
      const ix = v.position, iy = h.position;
      if (ix >= h.start - tolerance && ix <= h.end + tolerance && iy >= v.start - tolerance && iy <= v.end + tolerance) {
        if (ix > h.start + tolerance && ix < h.end - tolerance) {
          if (!hSplitPoints.has(hi)) hSplitPoints.set(hi, []);
          hSplitPoints.get(hi).push(ix);
        }
        if (iy > v.start + tolerance && iy < v.end - tolerance) {
          if (!vSplitPoints.has(vi)) vSplitPoints.set(vi, []);
          vSplitPoints.get(vi).push(iy);
        }
      }
    }
  }
  const result = [];
  const splitSegments = (segments, splitMap, axis) => {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i], splits = splitMap.get(i);
      if (splits && splits.length > 0) {
        const sorted = [...new Set(splits)].sort((a, b) => a - b);
        let current = seg.start;
        for (const sp of sorted) {
          if (sp > current + tolerance) result.push({ axis, position: seg.position, start: current, end: sp });
          current = sp;
        }
        if (seg.end > current + tolerance) result.push({ axis, position: seg.position, start: current, end: seg.end });
      } else { result.push(seg); }
    }
  };
  splitSegments(hSegments, hSplitPoints, "H");
  splitSegments(vSegments, vSplitPoints, "V");
  return result;
}

function _mapThicknessesAfterSplit(resolved, originalH, originalV, hThicknesses, vThicknesses) {
  return resolved.map((seg) => {
    const origList = seg.axis === "H" ? originalH : originalV;
    const thickList = seg.axis === "H" ? hThicknesses : vThicknesses;
    for (let i = 0; i < origList.length; i++) {
      const orig = origList[i];
      if (orig.position === seg.position && seg.start >= orig.start - 1 && seg.end <= orig.end + 1) return thickList[i];
    }
    return 2;
  });
}

function _chainColinearSegments(pairs, pairThicknesses, perpDistTol, darkThreshold, mask, w, h) {
  if (pairs.length === 0) return { polylines: [], thicknesses: [] };
  const segData = pairs.map((p, i) => {
    const dx = p.p2.x - p.p1.x, dy = p.p2.y - p.p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    return {
      idx: i, p1: p.p1, p2: p.p2, dx, dy, len,
      ux: len > 0 ? dx / len : 1, uy: len > 0 ? dy / len : 0,
      mx: (p.p1.x + p.p2.x) / 2, my: (p.p1.y + p.p2.y) / 2,
      angle: Math.atan2(dy, dx), thickness: pairThicknesses[i],
    };
  });
  const ANGLE_TOL = Math.PI / 18;
  const used = new Array(segData.length).fill(false);
  const polylines = [], thicknesses = [];

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
          if (_areColinearWithDarkCheck(member, segData[j], ANGLE_TOL, perpDistTol, darkThreshold, mask, w, h)) {
            group.push(segData[j]); used[j] = true; changed = true; break;
          }
        }
      }
    }
    const ref = group[0];
    group.sort((a, b) => {
      const projA = (a.mx - ref.p1.x) * ref.ux + (a.my - ref.p1.y) * ref.uy;
      const projB = (b.mx - ref.p1.x) * ref.ux + (b.my - ref.p1.y) * ref.uy;
      return projA - projB;
    });
    const chain = [];
    for (const seg of group) {
      const proj1 = (seg.p1.x - ref.p1.x) * ref.ux + (seg.p1.y - ref.p1.y) * ref.uy;
      const proj2 = (seg.p2.x - ref.p1.x) * ref.ux + (seg.p2.y - ref.p1.y) * ref.uy;
      if (proj1 <= proj2) { chain.push(seg.p1, seg.p2); } else { chain.push(seg.p2, seg.p1); }
    }
    const deduped = [chain[0]];
    for (let k = 1; k < chain.length; k++) {
      if (Math.hypot(chain[k].x - deduped[deduped.length - 1].x, chain[k].y - deduped[deduped.length - 1].y) > perpDistTol) deduped.push(chain[k]);
    }
    if (deduped.length >= 2) {
      polylines.push(deduped);
      const gt = group.map((s) => s.thickness).sort((a, b) => a - b);
      thicknesses.push(gt[Math.floor(gt.length / 2)]);
    }
  }
  return { polylines, thicknesses };
}

function _areColinearWithDarkCheck(segA, segB, angleTol, perpTol, darkThreshold, mask, w, h) {
  let dAngle = Math.abs(segA.angle - segB.angle);
  if (dAngle > Math.PI) dAngle = 2 * Math.PI - dAngle;
  if (dAngle > Math.PI / 2) dAngle = Math.PI - dAngle;
  if (dAngle > angleTol) return false;

  const dxBmA = segB.mx - segA.p1.x, dyBmA = segB.my - segA.p1.y;
  const perpDist = Math.abs(dxBmA * (-segA.uy) + dyBmA * segA.ux);
  if (perpDist > perpTol) return false;

  // Find closest endpoints
  const eps = [
    { from: segA.p2, to: segB.p1 }, { from: segA.p2, to: segB.p2 },
    { from: segA.p1, to: segB.p1 }, { from: segA.p1, to: segB.p2 },
  ];
  let bestGap = Infinity, gapFrom = null, gapTo = null;
  for (const ep of eps) {
    const d = Math.hypot(ep.from.x - ep.to.x, ep.from.y - ep.to.y);
    if (d < bestGap) { bestGap = d; gapFrom = ep.from; gapTo = ep.to; }
  }
  if (bestGap <= perpTol) return true;

  // Check pixels along the gap using chunks — every chunk must be dark
  return _isSegmentOnWall(gapFrom, gapTo, mask, w, h);
}
