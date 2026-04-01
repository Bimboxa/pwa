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

    // 3d. Room mask (1 = inside a room polygon, 0 = outside/wall)
    // Used to distinguish peripheral walls (outside on one side) from interior walls.
    const wWidth = roiW;
    const wHeight = roiH;
    const wRoomMask = new Uint8Array(wWidth * wHeight);
    for (let i = 0; i < wWidth * wHeight; i++) {
      wRoomMask[i] = maskImageData.data[i * 4] > 128 ? 1 : 0;
    }

    // 3e. wallMask = NOT room AND dark on image
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
      wWallMask, wRoomMask, wWidth, wHeight, distMat, meterByPx, maxLineGap,
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

// Utility: coordinate key for point matching (rounded to 1px)
const _ptKey = (x, y) => `${Math.round(x)},${Math.round(y)}`;

function _postProcessSegments(rawSegments, ctx) {
  const { wWallMask, wRoomMask, wWidth, wHeight, distMat, meterByPx, maxLineGap } = ctx;

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

  // ── Phase 1.0: Classify peripheral vs interior segments ─────────────
  // Peripheral walls have "outside" (non-mask) on one side.
  // Interior walls have mask (rooms/walls) on both sides.
  const { peripheral: periH, interior: intH } = _classifyPeripheral(mergedH, wRoomMask, wWidth, wHeight, "H", distMat);
  const { peripheral: periV, interior: intV } = _classifyPeripheral(mergedV, wRoomMask, wWidth, wHeight, "V", distMat);

  // ── Phase 1.1: Process peripheral walls ───────────────────────────
  const periResult = _processWallGroup(periH, periV, [], ctx);

  // ── Phase 1.2: Process interior walls with peripheral context ─────
  // TODO: uncomment when Phase 1.1 is validated
  // const intResult = _processWallGroup(intH, intV, periResult.polylines, ctx);
  // const allPolylines = [...periResult.polylines, ...intResult.polylines];
  // const allThicknesses = [...periResult.thicknesses, ...intResult.thicknesses];
  const allPolylines = periResult.polylines;
  const allThicknesses = periResult.thicknesses;

  // ── Phase 7: Junction resolution (L/T/X) — FINAL STEP ──────────────
  const maxThicknessAll = allThicknesses.length > 0 ? Math.max(...allThicknesses) : 20;
  const junctionSnapTol = Math.max(5, Math.round(maxThicknessAll * 0.75));
  const finalResult = _insertJunctionPoints(allPolylines, allThicknesses, junctionSnapTol);

  return finalResult;
}

/**
 * Classify segments as peripheral (one side faces outside) or interior (rooms on both sides).
 * Checks pixels perpendicular to the segment on both sides beyond the wall thickness.
 */
/**
 * Classify segments as peripheral or interior using the room mask.
 * Room mask: 1 = inside a flood fill polygon (room), 0 = outside building or wall material.
 *
 * Peripheral wall: one side faces outside (roomMask = 0 beyond the wall)
 * Interior wall: both sides face rooms (roomMask = 1 beyond the wall on both sides)
 */
function _classifyPeripheral(segments, roomMask, w, h, axis, distMat) {
  const peripheral = [], interior = [];
  const sampleCount = 10;

  for (const seg of segments) {
    // Estimate wall half-width from distance transform
    const midT = Math.round((seg.start + seg.end) / 2);
    let halfWidth;
    if (axis === "H") {
      halfWidth = Math.max(5, Math.round(distMat.floatAt(
        Math.min(h - 1, Math.max(0, seg.position)),
        Math.min(w - 1, Math.max(0, midT))
      )));
    } else {
      halfWidth = Math.max(5, Math.round(distMat.floatAt(
        Math.min(h - 1, Math.max(0, midT)),
        Math.min(w - 1, Math.max(0, seg.position))
      )));
    }

    // Probe beyond the wall on both sides — check room mask
    const probeOffset = halfWidth + 15;
    let sideARoom = 0, sideBRoom = 0;

    for (let s = 0; s < sampleCount; s++) {
      const t = Math.round(seg.start + (s + 0.5) * (seg.end - seg.start) / sampleCount);
      let pxA, pyA, pxB, pyB;
      if (axis === "H") {
        pxA = t; pyA = seg.position - probeOffset; // above
        pxB = t; pyB = seg.position + probeOffset; // below
      } else {
        pxA = seg.position - probeOffset; pyA = t; // left
        pxB = seg.position + probeOffset; pyB = t; // right
      }

      // Side A: is it inside a room?
      if (pxA >= 0 && pxA < w && pyA >= 0 && pyA < h && roomMask[pyA * w + pxA]) {
        sideARoom++;
      }
      // Side B: is it inside a room?
      if (pxB >= 0 && pxB < w && pyB >= 0 && pyB < h && roomMask[pyB * w + pxB]) {
        sideBRoom++;
      }
    }

    // Peripheral = significant asymmetry between the two sides.
    // One side faces the flood fill polygon (exterior), the other doesn't.
    // Interior = both sides similar (both inside the building, no polygon).
    const asymmetry = Math.abs(sideARoom - sideBRoom);
    const asymThreshold = sampleCount * 0.4;
    if (asymmetry >= asymThreshold) {
      peripheral.push(seg);
    } else {
      interior.push(seg);
    }
  }

  return { peripheral, interior };
}

/**
 * Process a group of H/V wall segments through the full pipeline
 * (grid snap → gap fill → extend → topology → chain → simplify).
 *
 * @param {Array} contextPolylines - Polylines from previous phases (e.g. peripheral walls)
 *   used as barriers for extension and as context for step junctions.
 */
function _processWallGroup(hSegs, vSegs, contextPolylines, ctx) {
  const { wWallMask, wWidth, wHeight, distMat, meterByPx, maxLineGap } = ctx;

  if (hSegs.length === 0 && vSegs.length === 0) {
    return { polylines: [], thicknesses: [] };
  }

  const posTolerance = meterByPx > 0 ? Math.max(3, Math.round(0.03 / meterByPx)) : 5;
  const gapTolerance = meterByPx > 0 ? Math.max(maxLineGap * 2, Math.round(0.10 / meterByPx)) : maxLineGap * 3;

  // ── Grid snap ──────────────────────────────────────────────────────
  const gridTolerance = meterByPx > 0 ? Math.max(3, Math.round(0.02 / meterByPx)) : 4;
  const hGridLines = _buildGridLines(hSegs.map((s) => s.position), gridTolerance);
  const vGridLines = _buildGridLines(vSegs.map((s) => s.position), gridTolerance);
  for (const seg of hSegs) seg.position = _snapToGrid(seg.position, hGridLines);
  for (const seg of vSegs) seg.position = _snapToGrid(seg.position, vGridLines);
  let mergedH = _mergeColinear(hSegs, 1, gapTolerance);
  let mergedV = _mergeColinear(vSegs, 1, gapTolerance);

  // ── Gap fill ───────────────────────────────────────────────────────
  const gapFillMaxDistance = meterByPx > 0 ? Math.round(0.30 / meterByPx) : 40;
  mergedH = _fillGapsOnGridLines(mergedH, wWallMask, wWidth, wHeight, "H", gapFillMaxDistance, distMat);
  mergedV = _fillGapsOnGridLines(mergedV, wWallMask, wWidth, wHeight, "V", gapFillMaxDistance, distMat);

  // ── Extend to wall extent (with perpendicular barriers) ────────────
  // Include context polylines as additional barriers
  const allBarriersV = [...mergedV];
  const allBarriersH = [...mergedH];
  // Convert context polylines to pseudo-segments for barrier detection
  for (const pl of contextPolylines) {
    if (pl.length < 2) continue;
    const first = pl[0], last = pl[pl.length - 1];
    const dx = Math.abs(last.x - first.x), dy = Math.abs(last.y - first.y);
    if (dy > dx * 2) {
      // V-ish context wall → barrier for H segments
      allBarriersV.push({ position: Math.round((first.x + last.x) / 2), start: Math.min(first.y, last.y), end: Math.max(first.y, last.y) });
    } else if (dx > dy * 2) {
      // H-ish context wall → barrier for V segments
      allBarriersH.push({ position: Math.round((first.y + last.y) / 2), start: Math.min(first.x, last.x), end: Math.max(first.x, last.x) });
    }
  }
  _extendToWallExtent(mergedH, wWallMask, wWidth, wHeight, "H", distMat, allBarriersV);
  _extendToWallExtent(mergedV, wWallMask, wWidth, wHeight, "V", distMat, allBarriersH);

  // ── Thickness, snap, extend, topology ──────────────────────────────
  const hThicknesses = mergedH.map((seg) => _measureThickness(seg, distMat, wWidth, wHeight));
  const vThicknesses = mergedV.map((seg) => _measureThickness(seg, distMat, wWidth, wHeight));

  const snapTolerance = meterByPx > 0 ? Math.max(5, Math.round(0.05 / meterByPx)) : 8;
  _snapEndpoints(mergedH, mergedV, snapTolerance);
  const maxThicknessH = hThicknesses.length > 0 ? Math.max(...hThicknesses) : 20;
  const maxThicknessV = vThicknesses.length > 0 ? Math.max(...vThicknesses) : 20;
  const extendTolerance = Math.max(15, Math.round(Math.max(maxThicknessH, maxThicknessV) * 1.5));
  _extendEndpoints(mergedH, mergedV, extendTolerance, wWallMask, wWidth, wHeight);

  const resolved = _resolveTopology(mergedH, mergedV, snapTolerance);
  const resolvedThicknesses = _mapThicknessesAfterSplit(resolved, mergedH, mergedV, hThicknesses, vThicknesses);

  // ── Convert to endpoint pairs ──────────────────────────────────────
  const pairs = [];
  const pairThicknesses = [];
  for (let i = 0; i < resolved.length; i++) {
    const seg = resolved[i];
    if (seg.axis === "H") {
      pairs.push({ p1: { x: seg.start, y: seg.position }, p2: { x: seg.end, y: seg.position } });
    } else {
      pairs.push({ p1: { x: seg.position, y: seg.start }, p2: { x: seg.position, y: seg.end } });
    }
    pairThicknesses.push(resolvedThicknesses[i]);
  }

  // ── Chain colinear segments ────────────────────────────────────────
  const colinearDistTol = meterByPx > 0 ? Math.max(5, Math.round(0.05 / meterByPx)) : 8;
  const chainResult = _chainColinearSegments(pairs, pairThicknesses, colinearDistTol, 0.4, wWallMask, wWidth, wHeight);

  // ── Gap fill (endpoint connectors) ─────────────────────────────────
  const gapMaxDist = meterByPx > 0 ? Math.max(10, Math.round(0.30 / meterByPx)) : 30;
  const gapResult = _fillEndpointGaps(
    chainResult.polylines, chainResult.thicknesses,
    gapMaxDist, wWallMask, wWidth, wHeight, distMat, 0
  );

  // ── Remove noise, stubs, zigzags, simplify ─────────────────────────
  const junctionNoiseMaxLen = meterByPx > 0 ? Math.round(0.40 / meterByPx) : 60;
  const junctionSnapDist = meterByPx > 0 ? Math.max(15, Math.round(0.25 / meterByPx)) : 40;
  const cleanResult = _removeJunctionNoise(gapResult.polylines, gapResult.thicknesses, junctionNoiseMaxLen, junctionSnapDist);

  // Remove stubs
  let resultPolylines = [], resultThicknesses = [];
  for (let i = 0; i < cleanResult.polylines.length; i++) {
    const pl = cleanResult.polylines[i];
    if (pl.length >= 2) {
      let totalLen = 0;
      for (let k = 1; k < pl.length; k++) totalLen += Math.sqrt((pl[k].x - pl[k - 1].x) ** 2 + (pl[k].y - pl[k - 1].y) ** 2);
      if (totalLen <= (cleanResult.thicknesses[i] || 0) * 1.5) continue;
    }
    resultPolylines.push(pl);
    resultThicknesses.push(cleanResult.thicknesses[i]);
  }

  // Zigzag removal
  const noZigzag = _removeZigzags(resultPolylines, resultThicknesses);

  // RDP simplification
  const rdpTolerance = meterByPx > 0 ? Math.max(3, Math.round(0.03 / meterByPx)) : 5;
  const rdpResult = _simplifyColinearPoints(noZigzag.polylines, noZigzag.thicknesses, rdpTolerance);

  // Step junctions
  const stepMaxGap = meterByPx > 0 ? Math.max(20, Math.round(1.5 / meterByPx)) : 150;
  const stepResult = _createStepJunctions(rdpResult.polylines, rdpResult.thicknesses, stepMaxGap, wWallMask, wWidth, wHeight, distMat, meterByPx);

  // Post-step cleanup (stubs + zigzags)
  let postPolylines = [], postThicknesses = [];
  for (let i = 0; i < stepResult.polylines.length; i++) {
    const pl = stepResult.polylines[i];
    if (pl.length >= 2) {
      let totalLen = 0;
      for (let k = 1; k < pl.length; k++) totalLen += Math.sqrt((pl[k].x - pl[k - 1].x) ** 2 + (pl[k].y - pl[k - 1].y) ** 2);
      if (totalLen <= (stepResult.thicknesses[i] || 0) * 1.5) continue;
    }
    postPolylines.push(pl);
    postThicknesses.push(stepResult.thicknesses[i]);
  }
  const postZigzag = _removeZigzags(postPolylines, postThicknesses);

  // Grid simplification
  const allGridLines = { h: hGridLines, v: vGridLines };
  const simplified = _simplifyPolylinesOnGrid(postZigzag.polylines, allGridLines, gridTolerance, wWallMask, wWidth, wHeight);

  return { polylines: simplified, thicknesses: postZigzag.thicknesses };
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 7: Junction point insertion (L/T/X)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Final pass: for each polyline endpoint that is near the BODY of another
 * polyline (T junction), insert the endpoint's coordinates into the other
 * polyline's point array. This creates shared point coordinates that the
 * hook will match via getOrCreatePoint().
 *
 * Also snaps L-junction endpoints to the exact same coordinates.
 */
function _insertJunctionPoints(polylines, thicknesses, snapTol) {
  // For each polyline, compute its direction (H or V) and bounding info
  const plData = polylines.map((pl) => {
    if (pl.length < 2) return null;
    const first = pl[0], last = pl[pl.length - 1];
    const dx = Math.abs(last.x - first.x), dy = Math.abs(last.y - first.y);
    const dir = dy > dx * 2 ? "V" : dx > dy * 2 ? "H" : null;
    return { dir, first, last };
  });

  // Point-to-segment perpendicular projection
  const projectOntoSegment = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { x: ax, y: ay, t: 0, dist: Math.sqrt((px - ax) ** 2 + (py - ay) ** 2) };
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const projX = ax + t * dx, projY = ay + t * dy;
    const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    return { x: projX, y: projY, t, dist };
  };

  // For each polyline's endpoints, check if they're near the body of another polyline
  for (let i = 0; i < polylines.length; i++) {
    const plA = polylines[i];
    if (plA.length < 2) continue;
    const dataA = plData[i];
    if (!dataA) continue;

    const endpoints = [plA[0], plA[plA.length - 1]];

    for (const ep of endpoints) {
      for (let j = 0; j < polylines.length; j++) {
        if (j === i) continue;
        const plB = polylines[j];
        if (plB.length < 2) continue;

        // Check each segment of polyline B
        for (let k = 0; k < plB.length - 1; k++) {
          const segStart = plB[k], segEnd = plB[k + 1];
          const proj = projectOntoSegment(ep.x, ep.y, segStart.x, segStart.y, segEnd.x, segEnd.y);

          if (proj.dist > snapTol) continue;
          if (proj.t < 0.05 || proj.t > 0.95) continue; // near endpoint, not body — skip (L junction handled by snap)

          // T junction: endpoint of A is near the body of B
          // Insert the projected point into B's point array
          const insertPt = { x: Math.round(proj.x * 10) / 10, y: Math.round(proj.y * 10) / 10 };

          // Check if point already exists nearby in B
          let alreadyExists = false;
          for (const pt of plB) {
            if (Math.abs(pt.x - insertPt.x) < 2 && Math.abs(pt.y - insertPt.y) < 2) {
              // Snap endpoint to existing point
              ep.x = pt.x;
              ep.y = pt.y;
              alreadyExists = true;
              break;
            }
          }

          if (!alreadyExists) {
            // Insert the point into B at the right position
            plB.splice(k + 1, 0, insertPt);
            // Snap endpoint of A to the inserted point
            ep.x = insertPt.x;
            ep.y = insertPt.y;
          }
          break; // one junction per endpoint
        }
      }
    }
  }

  // ── L junctions: two orthogonal endpoints near each other ──────────
  // Extend both lines to their intersection and replace both endpoints
  // with the shared intersection point.
  const connected = new Set();
  for (let i = 0; i < polylines.length; i++) {
    const plA = polylines[i];
    if (plA.length < 2 || !plData[i] || !plData[i].dir) continue;

    for (let ei = 0; ei < 2; ei++) {
      const epA = ei === 0 ? plA[0] : plA[plA.length - 1];
      const keyA = `${i}_${ei}`;
      if (connected.has(keyA)) continue;

      // Direction vector of A's last segment near this endpoint
      const segA = ei === 0
        ? { dx: plA[1].x - plA[0].x, dy: plA[1].y - plA[0].y }
        : { dx: plA[plA.length - 1].x - plA[plA.length - 2].x, dy: plA[plA.length - 1].y - plA[plA.length - 2].y };

      for (let j = i + 1; j < polylines.length; j++) {
        const plB = polylines[j];
        if (plB.length < 2 || !plData[j] || !plData[j].dir) continue;
        if (plData[i].dir === plData[j].dir) continue; // must be orthogonal

        for (let ej = 0; ej < 2; ej++) {
          const epB = ej === 0 ? plB[0] : plB[plB.length - 1];
          const keyB = `${j}_${ej}`;
          if (connected.has(keyB)) continue;

          const dist = Math.sqrt((epA.x - epB.x) ** 2 + (epA.y - epB.y) ** 2);
          if (dist > snapTol * 2) continue;

          // Direction vector of B's last segment near this endpoint
          const segB = ej === 0
            ? { dx: plB[1].x - plB[0].x, dy: plB[1].y - plB[0].y }
            : { dx: plB[plB.length - 1].x - plB[plB.length - 2].x, dy: plB[plB.length - 1].y - plB[plB.length - 2].y };

          // Compute intersection of the two lines
          // Line A: epA + t * segA, Line B: epB + s * segB
          const denom = segA.dx * segB.dy - segA.dy * segB.dx;
          if (Math.abs(denom) < 0.01) continue; // parallel

          const t = ((epB.x - epA.x) * segB.dy - (epB.y - epA.y) * segB.dx) / denom;
          const ix = Math.round((epA.x + t * segA.dx) * 10) / 10;
          const iy = Math.round((epA.y + t * segA.dy) * 10) / 10;

          // Check intersection is reasonable (not too far from endpoints)
          const distAtoI = Math.sqrt((epA.x - ix) ** 2 + (epA.y - iy) ** 2);
          const distBtoI = Math.sqrt((epB.x - ix) ** 2 + (epB.y - iy) ** 2);
          if (distAtoI > snapTol * 3 || distBtoI > snapTol * 3) continue;

          // Replace both endpoints with the intersection point
          epA.x = ix; epA.y = iy;
          epB.x = ix; epB.y = iy;

          connected.add(keyA);
          connected.add(keyB);
          break;
        }
        if (connected.has(keyA)) break;
      }
    }
  }

  // ── Clean: remove consecutive duplicate points ──────────────────────
  for (const pl of polylines) {
    for (let k = pl.length - 1; k > 0; k--) {
      if (Math.abs(pl[k].x - pl[k - 1].x) < 1 && Math.abs(pl[k].y - pl[k - 1].y) < 1) {
        pl.splice(k, 1);
      }
    }
  }

  return { polylines, thicknesses };
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
// Phase 5d: Zigzag removal
// ═══════════════════════════════════════════════════════════════════════

/**
 * Remove intermediate points that cause direction reversals (zigzags).
 * A zigzag at point B in A→B→C is detected when the dot product of
 * direction vectors AB and BC is negative (angle > 90°).
 * Iterates until no more zigzags are found.
 */
function _removeZigzags(polylines, thicknesses) {
  const cleaned = polylines.map((pl) => {
    if (pl.length <= 2) return pl;

    let points = [...pl];
    let changed = true;

    while (changed) {
      changed = false;
      const kept = [points[0]];

      for (let i = 1; i < points.length - 1; i++) {
        const curr = points[i];
        const prev = kept[kept.length - 1];
        const next = points[i + 1];

        // Direction vectors
        const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x, dy2 = next.y - curr.y;

        // Dot product — negative means direction reversal (> 90°)
        const dot = dx1 * dx2 + dy1 * dy2;

        if (dot < 0) {
          // Zigzag detected — skip this point
          changed = true;
          continue;
        }
        kept.push(curr);
      }

      kept.push(points[points.length - 1]);
      points = kept;

      if (points.length <= 2) break;
    }

    return points;
  });

  return { polylines: cleaned, thicknesses: [...thicknesses] };
}


// ═══════════════════════════════════════════════════════════════════════
// Phase 5d½: Colinear point simplification (Ramer-Douglas-Peucker)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Simplify polylines by removing intermediate points that lie within
 * `tolerance` pixels of the line between their kept neighbours.
 * Uses the Ramer-Douglas-Peucker algorithm.
 */
function _simplifyColinearPoints(polylines, thicknesses, tolerance) {
  const simplified = polylines.map((pl) => {
    if (pl.length <= 2) return pl;
    return _rdp(pl, tolerance);
  });
  return { polylines: simplified, thicknesses: [...thicknesses] };
}

/**
 * Ramer-Douglas-Peucker recursive simplification.
 * Returns a subset of points from the input array.
 */
function _rdp(points, epsilon) {
  if (points.length <= 2) return points;

  const first = points[0];
  const last = points[points.length - 1];
  let maxDist = 0;
  let maxIdx = 0;

  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const lenSq = dx * dx + dy * dy;

  for (let i = 1; i < points.length - 1; i++) {
    let dist;
    if (lenSq === 0) {
      dist = Math.sqrt((points[i].x - first.x) ** 2 + (points[i].y - first.y) ** 2);
    } else {
      const t = Math.max(0, Math.min(1, ((points[i].x - first.x) * dx + (points[i].y - first.y) * dy) / lenSq));
      const projX = first.x + t * dx;
      const projY = first.y + t * dy;
      dist = Math.sqrt((points[i].x - projX) ** 2 + (points[i].y - projY) ** 2);
    }
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    // Recurse on both halves
    const left = _rdp(points.slice(0, maxIdx + 1), epsilon);
    const right = _rdp(points.slice(maxIdx), epsilon);
    // Combine, removing duplicate at junction
    return [...left.slice(0, -1), ...right];
  } else {
    // All intermediate points are within tolerance — keep only endpoints
    return [first, last];
  }
}


// ═══════════════════════════════════════════════════════════════════════
// Phase 5e: Step junctions
// ═══════════════════════════════════════════════════════════════════════

/**
 * Detect pairs of near-parallel walls (V-V or H-H) that are slightly offset
 * and connected by a visible orthogonal dark band.
 *
 * Pattern: two verticals offset in X, connected by a short horizontal, or
 *          two horizontals offset in Y, connected by a short vertical.
 *
 * For each valid pair, creates an L-shaped connector:
 * - Extends wall A to the intersection line
 * - Creates the orthogonal connector segment
 * - Extends wall B to the intersection line
 * - Shares intersection points for clean topology
 */
function _createStepJunctions(polylines, thicknesses, maxGap, mask, w, h, distMat, meterByPx) {
  const result = { polylines: [...polylines], thicknesses: [...thicknesses] };

  // Classify each polyline as predominantly H or V
  const getDirection = (pl) => {
    if (pl.length < 2) return null;
    const first = pl[0], last = pl[pl.length - 1];
    const dx = Math.abs(last.x - first.x);
    const dy = Math.abs(last.y - first.y);
    if (dy > dx * 2) return "V";
    if (dx > dy * 2) return "H";
    return null; // diagonal — skip
  };

  // Get the endpoint and the "other end" direction for extending
  const getEndpoints = (pl) => ({
    start: pl[0],
    end: pl[pl.length - 1],
  });

  const minConnLen = meterByPx > 0 ? Math.round(0.05 / meterByPx) : 5;
  const connected = new Set(); // track which endpoints are already connected

  for (let i = 0; i < result.polylines.length; i++) {
    const plA = result.polylines[i];
    const dirA = getDirection(plA);
    if (!dirA) continue;

    for (let j = i + 1; j < result.polylines.length; j++) {
      const plB = result.polylines[j];
      const dirB = getDirection(plB);
      if (dirB !== dirA) continue; // must be same direction (V-V or H-H)

      const epsA = getEndpoints(plA);
      const epsB = getEndpoints(plB);

      // Try all 4 endpoint combinations: A.start-B.start, A.start-B.end, A.end-B.start, A.end-B.end
      const pairs = [
        { pA: epsA.start, pB: epsB.start, idxA: 0, idxB: 0, sideA: "start", sideB: "start" },
        { pA: epsA.start, pB: epsB.end, idxA: 0, idxB: plB.length - 1, sideA: "start", sideB: "end" },
        { pA: epsA.end, pB: epsB.start, idxA: plA.length - 1, idxB: 0, sideA: "end", sideB: "start" },
        { pA: epsA.end, pB: epsB.end, idxA: plA.length - 1, idxB: plB.length - 1, sideA: "end", sideB: "end" },
      ];

      // Sort pairs by distance (shortest first) so bridged short gaps
      // prevent longer redundant connections between the same walls
      const scoredPairs = pairs.map(p => ({
        ...p,
        dist: Math.sqrt((p.pA.x - p.pB.x) ** 2 + (p.pA.y - p.pB.y) ** 2),
      })).sort((a, b) => a.dist - b.dist);

      let wallPairBridged = false;

      for (const { pA, pB, sideA, sideB, dist } of scoredPairs) {
        if (wallPairBridged) break; // if any pair is bridged, skip ALL pairs for i-j
        const keyA = `${i}_${sideA}`;
        const keyB = `${j}_${sideB}`;
        if (connected.has(keyA) || connected.has(keyB)) continue;

        if (dist < minConnLen || dist > maxGap) continue;

        // For V-V: the orthogonal offset is in X, the along-axis offset is in Y
        // For H-H: the orthogonal offset is in Y, the along-axis offset is in X
        let orthoOffset, alongOffset;
        if (dirA === "V") {
          orthoOffset = Math.abs(pA.x - pB.x);
          alongOffset = Math.abs(pA.y - pB.y);
        } else {
          orthoOffset = Math.abs(pA.y - pB.y);
          alongOffset = Math.abs(pA.x - pB.x);
        }

        // Must have significant orthogonal offset (otherwise they're colinear, not stepped)
        if (orthoOffset < minConnLen) continue;
        // Along-axis offset should be reasonable (not too far apart along the wall direction)
        if (alongOffset > maxGap) continue;

        // Check if another polyline has an endpoint inside the bounding box
        // between pA and pB (with margin). If so, the junction area is already
        // populated — no step connector needed.
        const margin = Math.max(10, orthoOffset * 0.3);
        const boxMinX = Math.min(pA.x, pB.x) - margin;
        const boxMaxX = Math.max(pA.x, pB.x) + margin;
        const boxMinY = Math.min(pA.y, pB.y) - margin;
        const boxMaxY = Math.max(pA.y, pB.y) + margin;
        let alreadyBridged = false;
        for (let k = 0; k < result.polylines.length; k++) {
          if (k === i || k === j) continue;
          const plK = result.polylines[k];
          for (const pt of [plK[0], plK[plK.length - 1]]) {
            if (pt.x >= boxMinX && pt.x <= boxMaxX &&
                pt.y >= boxMinY && pt.y <= boxMaxY) {
              alreadyBridged = true;
              break;
            }
          }
          if (alreadyBridged) break;
        }
        if (alreadyBridged) {
          wallPairBridged = true;
          continue;
        }

        // Determine the connector: an L-shape going from pA orthogonally to pB's axis,
        // then along to pB. The corner point is at the intersection.
        let corner;
        if (dirA === "V") {
          // V walls: connector is horizontal. Corner shares Y with one and X with the other.
          // Use the Y that's "between" the two endpoints (midpoint, snapped to darker region)
          const midY = Math.round((pA.y + pB.y) / 2);
          corner = { x: pA.x, y: midY }; // extend pA straight, then go H to pB
          // Alternative corner: { x: pB.x, y: midY } — extend pB straight
          // Choose the one that best matches dark pixels
          const corner1 = { x: pA.x, y: midY };
          const corner2 = { x: pB.x, y: midY };
          // Connector via corner1: pA → corner1 (V extension) → pB (H connector)
          // Connector via corner2: pA → corner2 (H connector) → pB (V extension)

          // Test both L-shapes, pick the one with better dark pixel coverage
          const path1H = _isSegmentOnWall(corner1, { x: pB.x, y: midY }, mask, w, h);
          const path1V = _isSegmentOnWall(pA, corner1, mask, w, h);
          const path2H = _isSegmentOnWall({ x: pA.x, y: midY }, corner2, mask, w, h);
          const path2V = _isSegmentOnWall(corner2, pB, mask, w, h);

          const score1 = (path1H ? 1 : 0) + (path1V ? 1 : 0);
          const score2 = (path2H ? 1 : 0) + (path2V ? 1 : 0);

          if (score1 === 0 && score2 === 0) continue; // no dark pixels at all

          if (score1 >= score2) {
            corner = corner1;
            // Connector: horizontal from corner1 to {pB.x, midY}
            const connEnd = { x: pB.x, y: midY };
            if (!path1H) continue;
            // Measure thickness along the horizontal connector
            const thickness = _measureThicknessAlongLine(corner, connEnd, distMat, w, h);
            // Add the connector polyline
            result.polylines.push([{ ...corner }, { ...connEnd }]);
            result.thicknesses.push(thickness);
            // Extend wall A: add corner point to the appropriate end
            if (sideA === "end") plA.push({ ...corner });
            else plA.unshift({ ...corner });
            // Extend wall B: add connEnd point to the appropriate end
            if (sideB === "end") plB.push({ ...connEnd });
            else plB.unshift({ ...connEnd });
          } else {
            const connStart = { x: pA.x, y: midY };
            corner = corner2;
            if (!path2H) continue;
            const thickness = _measureThicknessAlongLine(connStart, corner, distMat, w, h);
            result.polylines.push([{ ...connStart }, { ...corner }]);
            result.thicknesses.push(thickness);
            if (sideA === "end") plA.push({ ...connStart });
            else plA.unshift({ ...connStart });
            if (sideB === "end") plB.push({ ...corner });
            else plB.unshift({ ...corner });
          }
        } else {
          // H walls: connector is vertical
          const midX = Math.round((pA.x + pB.x) / 2);
          const corner1 = { x: midX, y: pA.y };
          const corner2 = { x: midX, y: pB.y };

          const path1V = _isSegmentOnWall(corner1, { x: midX, y: pB.y }, mask, w, h);
          const path1H = _isSegmentOnWall(pA, corner1, mask, w, h);
          const path2V = _isSegmentOnWall({ x: midX, y: pA.y }, corner2, mask, w, h);
          const path2H = _isSegmentOnWall(corner2, pB, mask, w, h);

          const score1 = (path1V ? 1 : 0) + (path1H ? 1 : 0);
          const score2 = (path2V ? 1 : 0) + (path2H ? 1 : 0);

          if (score1 === 0 && score2 === 0) continue;

          if (score1 >= score2) {
            corner = corner1;
            const connEnd = { x: midX, y: pB.y };
            if (!path1V) continue;
            const thickness = _measureThicknessAlongLine(corner, connEnd, distMat, w, h);
            result.polylines.push([{ ...corner }, { ...connEnd }]);
            result.thicknesses.push(thickness);
            if (sideA === "end") plA.push({ ...corner });
            else plA.unshift({ ...corner });
            if (sideB === "end") plB.push({ ...connEnd });
            else plB.unshift({ ...connEnd });
          } else {
            const connStart = { x: midX, y: pA.y };
            corner = corner2;
            if (!path2V) continue;
            const thickness = _measureThicknessAlongLine(connStart, corner, distMat, w, h);
            result.polylines.push([{ ...connStart }, { ...corner }]);
            result.thicknesses.push(thickness);
            if (sideA === "end") plA.push({ ...connStart });
            else plA.unshift({ ...connStart });
            if (sideB === "end") plB.push({ ...corner });
            else plB.unshift({ ...corner });
          }
        }

        connected.add(keyA);
        connected.add(keyB);
        break; // one connection per endpoint pair
      }
    }
  }

  return result;
}

/**
 * Measure wall thickness along a line segment using the distance transform.
 */
function _measureThicknessAlongLine(pA, pB, distMat, w, h) {
  const dx = pB.x - pA.x, dy = pB.y - pA.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const numSamples = Math.min(20, Math.max(5, Math.floor(len / 5)));
  const samples = [];
  for (let s = 0; s < numSamples; s++) {
    const t = (s + 0.5) / numSamples;
    const px = Math.min(w - 1, Math.max(0, Math.round(pA.x + dx * t)));
    const py = Math.min(h - 1, Math.max(0, Math.round(pA.y + dy * t)));
    const dist = distMat.floatAt(py, px);
    if (dist > 0) samples.push(dist);
  }
  if (samples.length === 0) return 2;
  samples.sort((a, b) => a - b);
  return Math.max(2, samples[Math.floor(samples.length / 2)] * 2);
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

/**
 * Extend each segment's endpoints outward along its axis until the dark
 * pixels in the wall mask end. This captures wall material that HoughLinesP
 * detected partially.
 *
 * Scans pixel-by-pixel in the mask along the segment's position line.
 * Stops when hitting a run of consecutive white pixels (gap).
 */
function _extendToWallExtent(segments, mask, w, h, axis, distMat, perpSegments) {
  const maxWhiteRun = 2; // stop after 2 consecutive mostly-white slices
  const maxExtend = 200; // safety limit
  const darkThreshold = 0.8; // at least 80% of the band must be dark

  for (const seg of segments) {
    const pos = seg.position;
    const limit = axis === "H" ? w : h;

    // Estimate half-width of the wall from distMap at segment center
    const midT = Math.round((seg.start + seg.end) / 2);
    let halfWidth;
    if (axis === "H") {
      const mx = Math.min(w - 1, Math.max(0, midT));
      const my = Math.min(h - 1, Math.max(0, pos));
      halfWidth = Math.max(3, Math.round(distMat.floatAt(my, mx)));
    } else {
      const mx = Math.min(w - 1, Math.max(0, pos));
      const my = Math.min(h - 1, Math.max(0, midT));
      halfWidth = Math.max(3, Math.round(distMat.floatAt(my, mx)));
    }

    // Find perpendicular walls that this segment crosses — stop extending
    // past them. A perpendicular wall's "position" is the coordinate along
    // our axis where the crossing happens.
    const perpBarriers = [];
    for (const perp of perpSegments) {
      // perp.position is on our scanning axis (e.g. for V segments, perp H has position = Y)
      // Check if our segment's position falls within the perp's range
      if (pos >= perp.start - halfWidth && pos <= perp.end + halfWidth) {
        perpBarriers.push(perp.position);
      }
    }

    // Check if a perpendicular band at position t is mostly dark
    const isBandDark = (t) => {
      let dark = 0, total = 0;
      for (let d = -halfWidth; d <= halfWidth; d++) {
        let px, py;
        if (axis === "H") { px = t; py = pos + d; }
        else { px = pos + d; py = t; }
        if (px < 0 || px >= w || py < 0 || py >= h) continue;
        total++;
        if (mask[py * w + px]) dark++;
      }
      return total > 0 && (dark / total) >= darkThreshold;
    };

    // Extend START (scan backward) — stop at perpendicular walls
    let newStart = seg.start;
    let whiteCount = 0;
    const startBarrier = perpBarriers
      .filter(b => b < seg.start)
      .reduce((max, b) => Math.max(max, b), -Infinity);
    const startLimit = Math.max(0, seg.start - maxExtend,
      startBarrier !== -Infinity ? startBarrier - halfWidth : 0);
    for (let t = seg.start - 1; t >= startLimit; t--) {
      if (isBandDark(t)) {
        whiteCount = 0;
        newStart = t;
      } else {
        whiteCount++;
        if (whiteCount >= maxWhiteRun) break;
      }
    }
    // Snap to perpendicular wall position if we reached the barrier
    if (startBarrier !== -Infinity && newStart <= startBarrier + halfWidth) {
      newStart = startBarrier;
    }

    // Extend END (scan forward) — stop at perpendicular walls
    let newEnd = seg.end;
    whiteCount = 0;
    const endBarrier = perpBarriers
      .filter(b => b > seg.end)
      .reduce((min, b) => Math.min(min, b), Infinity);
    const endLimit = Math.min(limit, seg.end + maxExtend,
      endBarrier !== Infinity ? endBarrier + halfWidth : limit);
    for (let t = seg.end + 1; t < endLimit; t++) {
      if (isBandDark(t)) {
        whiteCount = 0;
        newEnd = t;
      } else {
        whiteCount++;
        if (whiteCount >= maxWhiteRun) break;
      }
    }
    // Snap to perpendicular wall position if we reached the barrier
    if (endBarrier !== Infinity && newEnd >= endBarrier - halfWidth) {
      newEnd = endBarrier;
    }

    seg.start = newStart;
    seg.end = newEnd;
  }
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

/**
 * Unified junction resolver: detects L/T/X intersections between H and V
 * segments, creates shared intersection points, and outputs endpoint pairs
 * with proper topology.
 *
 * For each H-V pair:
 *   - Intersection point = (V.position, H.position)
 *   - Classify each segment's relationship to the intersection:
 *     ENDPOINT: segment start/end is within tolerance of intersection → snap to it
 *     BODY: intersection falls inside the segment's range → split at intersection
 *     NONE: intersection is outside the segment → no junction
 *   - L junction: both segments have ENDPOINT at intersection
 *   - T junction: one ENDPOINT, one BODY
 *   - X junction: both BODY → split both
 */
function _resolveJunctions(hSegments, vSegments, hThicknesses, vThicknesses) {
  // Build thickness lookup: half-width tolerance for endpoint proximity
  const getHalfWidth = (thicknesses, idx) => Math.max(5, Math.round((thicknesses[idx] || 10) * 0.75));

  // Collect split points for each segment
  const hSplits = hSegments.map(() => new Set());
  const vSplits = vSegments.map(() => new Set());
  // Track endpoint snaps: which endpoints should be moved to intersection
  const hSnaps = hSegments.map(() => ({})); // { start: x, end: x }
  const vSnaps = vSegments.map(() => ({})); // { start: y, end: y }

  for (let hi = 0; hi < hSegments.length; hi++) {
    const h = hSegments[hi];
    const hHalf = getHalfWidth(hThicknesses, hi);

    for (let vi = 0; vi < vSegments.length; vi++) {
      const v = vSegments[vi];
      const vHalf = getHalfWidth(vThicknesses, vi);
      const tol = Math.max(hHalf, vHalf);

      // Intersection point
      const ix = v.position; // X of intersection = V segment's X position
      const iy = h.position; // Y of intersection = H segment's Y position

      // Check H segment's relationship to ix
      let hRel = "NONE";
      if (Math.abs(h.start - ix) <= tol) hRel = "START";
      else if (Math.abs(h.end - ix) <= tol) hRel = "END";
      else if (ix > h.start + tol && ix < h.end - tol) hRel = "BODY";

      // Check V segment's relationship to iy
      let vRel = "NONE";
      if (Math.abs(v.start - iy) <= tol) vRel = "START";
      else if (Math.abs(v.end - iy) <= tol) vRel = "END";
      else if (iy > v.start + tol && iy < v.end - tol) vRel = "BODY";

      if (hRel === "NONE" || vRel === "NONE") continue;

      // ── Snap endpoints to intersection ──
      if (hRel === "START") hSnaps[hi].start = ix;
      if (hRel === "END") hSnaps[hi].end = ix;
      if (vRel === "START") vSnaps[vi].start = iy;
      if (vRel === "END") vSnaps[vi].end = iy;

      // ── Split body segments at intersection ──
      if (hRel === "BODY") hSplits[hi].add(ix);
      if (vRel === "BODY") vSplits[vi].add(iy);
    }
  }

  // Apply snaps
  for (let i = 0; i < hSegments.length; i++) {
    if (hSnaps[i].start !== undefined) hSegments[i].start = hSnaps[i].start;
    if (hSnaps[i].end !== undefined) hSegments[i].end = hSnaps[i].end;
  }
  for (let i = 0; i < vSegments.length; i++) {
    if (vSnaps[i].start !== undefined) vSegments[i].start = vSnaps[i].start;
    if (vSnaps[i].end !== undefined) vSegments[i].end = vSnaps[i].end;
  }

  // Build output: each segment becomes ONE polyline with junction points
  // inserted as intermediate points (comb pattern for T junctions).
  const pairs = [];
  const thicknesses = [];

  const emitPolyline = (seg, junctionPoints, thickness, axis) => {
    const sorted = [...junctionPoints].sort((a, b) => a - b);
    // Build point array: start, junction points, end
    const coords = [seg.start, ...sorted.filter(jp => jp > seg.start + 1 && jp < seg.end - 1), seg.end];
    // Remove duplicates
    const unique = [coords[0]];
    for (let k = 1; k < coords.length; k++) {
      if (Math.abs(coords[k] - unique[unique.length - 1]) > 1) unique.push(coords[k]);
    }

    if (unique.length < 2) return;

    // Emit as polyline points
    const polyPoints = unique.map(t => {
      if (axis === "H") return { x: t, y: seg.position };
      else return { x: seg.position, y: t };
    });
    pairs.push(polyPoints);
    thicknesses.push(thickness);
  };

  for (let i = 0; i < hSegments.length; i++) {
    emitPolyline(hSegments[i], hSplits[i], hThicknesses[i], "H");
  }
  for (let i = 0; i < vSegments.length; i++) {
    emitPolyline(vSegments[i], vSplits[i], vThicknesses[i], "V");
  }

  return { pairs, thicknesses };
}

// Legacy functions kept for reference but no longer called in the main pipeline
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
