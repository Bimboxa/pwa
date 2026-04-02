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
      enableExteriorOrtho = true,
      enableExteriorClose = true,
      enableInterior = true,
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

    // Draw each boundary polygon with a unique index (1-based) in the red channel.
    // This allows _classifyPeripheral to distinguish which polygon each side belongs to.
    for (let bIdx = 0; bIdx < workBoundaries.length; bIdx++) {
      const pts = workBoundaries[bIdx].points;
      if (!pts || pts.length < 3) continue;
      const colorVal = bIdx + 1; // 1-based polygon index
      maskCtx.fillStyle = `rgb(${colorVal},${colorVal},${colorVal})`;
      maskCtx.beginPath();
      maskCtx.moveTo(pts[0].x - roiX0, pts[0].y - roiY0);
      for (let i = 1; i < pts.length; i++) maskCtx.lineTo(pts[i].x - roiX0, pts[i].y - roiY0);
      maskCtx.closePath();
      maskCtx.fill();
    }

    // Cuts = holes in rooms = wall/pillar areas (reset to 0)
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

    // 3d. Room mask (0 = outside, 1..N = polygon index)
    // Used to distinguish peripheral walls (different polygon or outside on one side)
    // from interior walls (same polygon on both sides).
    const wWidth = roiW;
    const wHeight = roiH;
    const wRoomMask = new Uint8Array(wWidth * wHeight);
    for (let i = 0; i < wWidth * wHeight; i++) {
      wRoomMask[i] = maskImageData.data[i * 4]; // polygon index (0 = outside)
    }

    // 3e. wallMask = NOT room AND dark on image
    const wWallMask = new Uint8Array(wWidth * wHeight);
    for (let i = 0; i < wWidth * wHeight; i++) {
      const isRoom = maskImageData.data[i * 4] > 0;
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
    // Collect cut polygons in ROI coordinates for envelope tracing
    const cutPolygons = [];
    for (const boundary of workBoundaries) {
      const cuts = boundary.cuts;
      if (!cuts || cuts.length === 0) continue;
      for (const cut of cuts) {
        if (!cut.points || cut.points.length < 3) continue;
        cutPolygons.push(cut.points.map(p => ({ x: p.x - roiX0, y: p.y - roiY0 })));
      }
    }

    // Build brightness array (ROI) for weighted centroid recentering
    const wBrightness = new Uint8Array(wWidth * wHeight);
    for (let i = 0; i < wWidth * wHeight; i++) {
      const imgX = (i % wWidth) + roiX0;
      const imgY = Math.floor(i / wWidth) + roiY0;
      const imgIdx = (imgY * width + imgX) * 4;
      wBrightness[i] = Math.round(data[imgIdx] * 0.299 + data[imgIdx + 1] * 0.587 + data[imgIdx + 2] * 0.114);
    }

    const postResult = _postProcessSegments(rawSegments, {
      wWallMask, wRoomMask, wWidth, wHeight, distMat, meterByPx, maxLineGap, cutPolygons, wBrightness,
      enableExteriorOrtho, enableExteriorClose, enableInterior,
    });
    let polylines = postResult.polylines;
    let thicknesses = postResult.thicknesses;

    // ── 9. Convert ROI coords back + rotate back ───────────────────────
    // +0.5: OpenCV integer coords = pixel top-left corner; shift to pixel center
    // +0.5: OpenCV integer coords = pixel top-left corner; shift to pixel center
    polylines = polylines.map((pl) => pl.map((p) => ({ x: p.x + roiX0 + 0.5, y: p.y + roiY0 + 0.5 })));

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

  const ENABLE_PERIPHERAL = ctx.enableExteriorOrtho !== false;
  const ENABLE_INTERIOR = ctx.enableInterior !== false;
  const ENABLE_CLOSE_ENVELOPE = ctx.enableExteriorClose !== false;

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
  const { peripheral: periH, interior: intH } = _classifyPeripheral(mergedH, wRoomMask, wWidth, wHeight, "H", distMat, meterByPx);
  const { peripheral: periV, interior: intV } = _classifyPeripheral(mergedV, wRoomMask, wWidth, wHeight, "V", distMat, meterByPx);

  console.log(`[classify] H: ${mergedH.length} total → ${periH.length} peripheral + ${intH.length} interior`);
  console.log(`[classify] V: ${mergedV.length} total → ${periV.length} peripheral + ${intV.length} interior`);
  for (const seg of periH) console.log(`  periH: y=${seg.position} x=${seg.start}→${seg.end} len=${seg.end-seg.start}`);
  for (const seg of intH) console.log(`  intH: y=${seg.position} x=${seg.start}→${seg.end} len=${seg.end-seg.start}`);

  // ═══ STEP 1: Peripheral ortho walls ═══════════════════════════════
  const periResult = ENABLE_PERIPHERAL
    ? _processWallGroup(periH, periV, [], ctx)
    : { polylines: [], thicknesses: [] };

  // ═══ STEP 2: Close peripheral envelope (curves, obliques) ════════
  let periPolylines = [...periResult.polylines];
  let periThicknesses = [...periResult.thicknesses];

  if (ENABLE_PERIPHERAL && periPolylines.length > 0) {
    // Junctions on peripheral walls only
    const periMaxThick = periThicknesses.length > 0 ? Math.max(...periThicknesses) : 20;
    const periSnapTol = Math.max(5, Math.round(periMaxThick * 0.75));
    const periJunc = _insertJunctionPoints(periPolylines, periThicknesses, periSnapTol, meterByPx);
    periPolylines = periJunc.polylines;
    periThicknesses = periJunc.thicknesses;
  }

  if (ENABLE_CLOSE_ENVELOPE && periPolylines.length > 0) {
    const envelopeResult = _closePeripheralEnvelope(periPolylines, periThicknesses, ctx);
    periPolylines.push(...envelopeResult.polylines);
    periThicknesses.push(...envelopeResult.thicknesses);
  }

  // ═══ STEP 3: Interior ortho walls ════════════════════════════════
  let intPolylines = [], intThicknesses = [];
  if (ENABLE_INTERIOR) {
    const filtIntH = _removeOverlappingSegments(intH, periH, posTolerance);
    const filtIntV = _removeOverlappingSegments(intV, periV, posTolerance);
    const validIntH = filtIntH.filter(seg => {
      const pA = { x: seg.start, y: seg.position };
      const pB = { x: seg.end, y: seg.position };
      return _isSegmentOnWall(pA, pB, wWallMask, wWidth, wHeight);
    });
    const validIntV = filtIntV.filter(seg => {
      const pA = { x: seg.position, y: seg.start };
      const pB = { x: seg.position, y: seg.end };
      return _isSegmentOnWall(pA, pB, wWallMask, wWidth, wHeight);
    });
    const intResult = _processWallGroup(validIntH, validIntV, [], ctx);

    // Junction resolution on interior walls
    const intMaxThick = intResult.thicknesses.length > 0 ? Math.max(...intResult.thicknesses) : 20;
    const intSnapTol = Math.max(5, Math.round(intMaxThick * 0.75));
    const intJunc = _insertJunctionPoints(intResult.polylines, intResult.thicknesses, intSnapTol, meterByPx);

    // Post-validate: reject polylines crossing non-wall zones
    for (let i = 0; i < intJunc.polylines.length; i++) {
      const pl = intJunc.polylines[i];
      if (pl.length < 2) continue;
      let valid = true;
      for (let k = 1; k < pl.length; k++) {
        if (!_isSegmentOnWall(pl[k - 1], pl[k], wWallMask, wWidth, wHeight)) {
          valid = false; break;
        }
      }
      if (valid) {
        intPolylines.push(pl);
        intThicknesses.push(intJunc.thicknesses[i]);
      }
    }

    // Step detection + colinear overlap on interior
    _resolveColinearOverlaps(intPolylines, intThicknesses, meterByPx);
    _detectAndConnectSteps(intPolylines, intThicknesses, wWallMask, wWidth, wHeight, distMat, meterByPx);
  }

  // ═══ STEP 4: Connect interior endpoints to exterior wall bodies ════
  if (intPolylines.length > 0 && periPolylines.length > 0) {
    const maxThick = Math.max(...periThicknesses, ...intThicknesses, 20);
    const intExtSnapTol = Math.max(5, Math.round(maxThick * 0.75));
    _connectInteriorToExterior(intPolylines, periPolylines, intExtSnapTol);
  }

  const allPolylines = [...periPolylines, ...intPolylines];
  const allThicknesses = [...periThicknesses, ...intThicknesses];

  return { polylines: allPolylines, thicknesses: allThicknesses };
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

/**
 * Resolve colinear overlaps: when two walls on close grid lines overlap
 * and have different thicknesses, trim the thinner wall so it stops
 * at the edge of the thicker wall (no visual overlap).
 * Modifies polylines/thicknesses in place (may remove entries).
 */
function _resolveColinearOverlaps(polylines, thicknesses, meterByPx) {
  // Classify each polyline direction and extent
  const info = polylines.map((pl, i) => {
    if (pl.length < 2) return null;
    const first = pl[0], last = pl[pl.length - 1];
    const dx = Math.abs(last.x - first.x), dy = Math.abs(last.y - first.y);
    if (dx > dy * 3) {
      return { dir: "H", pos: (first.y + last.y) / 2, start: Math.min(first.x, last.x), end: Math.max(first.x, last.x), thick: thicknesses[i] || 20 };
    }
    if (dy > dx * 3) {
      return { dir: "V", pos: (first.x + last.x) / 2, start: Math.min(first.y, last.y), end: Math.max(first.y, last.y), thick: thicknesses[i] || 20 };
    }
    return null;
  });

  const toRemove = new Set();
  const newPolylines = [];
  const newThicknesses = [];
  const snapTol = meterByPx > 0 ? Math.max(5, Math.round(0.15 / meterByPx)) : 15;

  for (let i = 0; i < polylines.length; i++) {
    if (!info[i] || toRemove.has(i)) continue;
    for (let j = i + 1; j < polylines.length; j++) {
      if (!info[j] || toRemove.has(j)) continue;
      if (info[i].dir !== info[j].dir) continue;

      // Check if on close grid lines (positions within sum of half-widths)
      const halfI = info[i].thick / 2, halfJ = info[j].thick / 2;
      const posDist = Math.abs(info[i].pos - info[j].pos);
      if (posDist > halfI + halfJ) continue;

      // Check overlap OR adjacency in extent
      const overlapStart = Math.max(info[i].start, info[j].start);
      const overlapEnd = Math.min(info[i].end, info[j].end);
      if (overlapEnd < overlapStart - snapTol) continue; // too far apart

      // Determine which is thicker
      const thickIdx = info[i].thick >= info[j].thick ? i : j;
      const thinIdx = thickIdx === i ? j : i;
      const thickInfo = info[thickIdx];
      const thinInfo = info[thinIdx];
      const thinPl = polylines[thinIdx];
      const thickPl = polylines[thickIdx];

      console.log(`[overlap] ${thinInfo.dir} thin(${Math.round(thinInfo.thick)}) pos=${Math.round(thinInfo.pos)} [${Math.round(thinInfo.start)}→${Math.round(thinInfo.end)}] vs thick(${Math.round(thickInfo.thick)}) pos=${Math.round(thickInfo.pos)} [${Math.round(thickInfo.start)}→${Math.round(thickInfo.end)}]`);

      if (thinInfo.start >= thickInfo.start - snapTol && thinInfo.end <= thickInfo.end + snapTol) {
        // Thin is fully inside thick → remove it
        toRemove.add(thinIdx);
        console.log(`[overlap]   → thin fully inside thick, removing`);
        continue;
      }

      // Trim thin wall: remove points inside the thick wall's extent
      const thickStart = thickInfo.start;
      const thickEnd = thickInfo.end;

      // Find the trim point: where does the thin wall enter the thick wall's zone?
      let trimX, trimSide; // "start" or "end" of thin being trimmed
      if (thinInfo.dir === "H") {
        if (thinInfo.start < thickStart && thinInfo.end > thickStart - snapTol) {
          trimX = thickStart;
          trimSide = "end";
        } else if (thinInfo.end > thickEnd && thinInfo.start < thickEnd + snapTol) {
          trimX = thickEnd;
          trimSide = "start";
        }
      } else {
        if (thinInfo.start < thickStart && thinInfo.end > thickStart - snapTol) {
          trimX = thickStart;
          trimSide = "end";
        } else if (thinInfo.end > thickEnd && thinInfo.start < thickEnd + snapTol) {
          trimX = thickEnd;
          trimSide = "start";
        }
      }

      if (trimX === undefined) continue;

      // Trim the thin polyline: keep only points before the trim point
      if (thinInfo.dir === "H") {
        const kept = thinPl.filter(p => trimSide === "end" ? p.x <= trimX + snapTol : p.x >= trimX - snapTol);
        if (kept.length < 1) { toRemove.add(thinIdx); continue; }
        // Set the last point exactly at the trim boundary
        const trimPt = trimSide === "end" ? kept[kept.length - 1] : kept[0];
        const trimPoint = { x: trimX, y: trimPt.y };
        if (trimSide === "end") {
          kept[kept.length - 1] = trimPoint;
        } else {
          kept[0] = trimPoint;
        }
        thinPl.splice(0, thinPl.length, ...kept);
      } else {
        const kept = thinPl.filter(p => trimSide === "end" ? p.y <= trimX + snapTol : p.y >= trimX - snapTol);
        if (kept.length < 1) { toRemove.add(thinIdx); continue; }
        const trimPt = trimSide === "end" ? kept[kept.length - 1] : kept[0];
        const trimPoint = { x: trimPt.x, y: trimX };
        if (trimSide === "end") {
          kept[kept.length - 1] = trimPoint;
        } else {
          kept[0] = trimPoint;
        }
        thinPl.splice(0, thinPl.length, ...kept);
      }

      // Create perpendicular STEP connector between thin and thick walls.
      // Both connection points share the same coordinate on the colinear axis.
      const thinEnd = trimSide === "end" ? thinPl[thinPl.length - 1] : thinPl[0];

      if (thinInfo.dir === "H") {
        // H walls: step is vertical, both points at same X = trimX
        const thickY = thickInfo.pos; // thick wall's Y position
        const stepDist = Math.abs(thinEnd.y - thickY);
        if (stepDist > 1 && stepDist < halfI + halfJ + snapTol) {
          const stepPl = [{ x: trimX, y: thinEnd.y }, { x: trimX, y: thickY }];
          newPolylines.push(stepPl);
          newThicknesses.push(Math.min(thinInfo.thick, thickInfo.thick));
          // Ensure thick wall has a point at the connection X
          _insertPointOnPolylineAtCoord(thickPl, "x", trimX, thickInfo.pos, snapTol);
          console.log(`[overlap]   → step V: x=${Math.round(trimX)} y=${Math.round(thinEnd.y)}→${Math.round(thickY)}`);
        }
      } else {
        // V walls: step is horizontal, both points at same Y = trimX (trimX is Y for V walls)
        const thickX = thickInfo.pos;
        const stepDist = Math.abs(thinEnd.x - thickX);
        if (stepDist > 1 && stepDist < halfI + halfJ + snapTol) {
          const stepPl = [{ x: thinEnd.x, y: trimX }, { x: thickX, y: trimX }];
          newPolylines.push(stepPl);
          newThicknesses.push(Math.min(thinInfo.thick, thickInfo.thick));
          _insertPointOnPolylineAtCoord(thickPl, "y", trimX, thickInfo.pos, snapTol);
          console.log(`[overlap]   → step H: y=${Math.round(trimX)} x=${Math.round(thinEnd.x)}→${Math.round(thickX)}`);
        }
      }

      // Clean up thick wall: remove extension points inside perpendicular walls
      // A point is parasitic if it's within halfWidth of the thick wall's endpoint
      // and within halfWidth of a perpendicular wall
      for (let pIdx = thickPl.length - 1; pIdx >= 0; pIdx--) {
        if (pIdx === 0 && thickPl.length <= 2) continue;
        if (pIdx === thickPl.length - 1 && thickPl.length <= 2) continue;
        // Only check actual endpoints (first/last)
        if (pIdx !== 0 && pIdx !== thickPl.length - 1) continue;
        const pt = thickPl[pIdx];
        const prevPt = pIdx === 0 ? thickPl[1] : thickPl[pIdx - 1];
        const segLen = Math.sqrt((pt.x - prevPt.x) ** 2 + (pt.y - prevPt.y) ** 2);
        if (segLen > thickInfo.thick) continue; // not a tiny extension
        // Check if this tiny extension is near a perpendicular wall
        for (let k = 0; k < polylines.length; k++) {
          if (k === thickIdx || !info[k] || toRemove.has(k)) continue;
          if (info[k].dir === thickInfo.dir) continue; // must be perpendicular
          const perpHalf = (info[k].thick || 20) / 2;
          // Check if the point is within the perpendicular wall's extent
          let withinPerp = false;
          if (info[k].dir === "V" && thickInfo.dir === "H") {
            withinPerp = Math.abs(pt.x - info[k].pos) < perpHalf + 5;
          } else if (info[k].dir === "H" && thickInfo.dir === "V") {
            withinPerp = Math.abs(pt.y - info[k].pos) < perpHalf + 5;
          }
          if (withinPerp) {
            console.log(`[overlap]   → removing parasitic point (${Math.round(pt.x)},${Math.round(pt.y)}) inside perp wall ${k}`);
            thickPl.splice(pIdx, 1);
            break;
          }
        }
      }

      // Update info
      const f = thinPl[0], l = thinPl[thinPl.length - 1];
      if (thinInfo.dir === "H") {
        thinInfo.start = Math.min(f.x, l.x);
        thinInfo.end = Math.max(f.x, l.x);
      } else {
        thinInfo.start = Math.min(f.y, l.y);
        thinInfo.end = Math.max(f.y, l.y);
      }
    }
  }

  // Remove fully overlapped polylines (reverse order)
  const removeList = [...toRemove].sort((a, b) => b - a);
  for (const idx of removeList) {
    polylines.splice(idx, 1);
    thicknesses.splice(idx, 1);
  }

  // Add step connectors
  polylines.push(...newPolylines);
  thicknesses.push(...newThicknesses);
}

/**
 * Detect step junctions: pairs of parallel segments with close endpoints,
 * verify a dark orthogonal wall connects them, and create the connector.
 * Modifies polylines/thicknesses arrays in place.
 */
function _detectAndConnectSteps(polylines, thicknesses, mask, w, h, distMat, meterByPx) {
  const maxStepDist = meterByPx > 0 ? Math.round(1.5 / meterByPx) : 150;
  const snapTol = meterByPx > 0 ? Math.max(5, Math.round(0.15 / meterByPx)) : 15;

  // Classify each polyline as H or V
  const plInfo = polylines.map((pl) => {
    if (pl.length < 2) return null;
    const first = pl[0], last = pl[pl.length - 1];
    const dx = Math.abs(last.x - first.x), dy = Math.abs(last.y - first.y);
    if (dx > dy * 3) return { dir: "H", pos: (first.y + last.y) / 2 };
    if (dy > dx * 3) return { dir: "V", pos: (first.x + last.x) / 2 };
    return null;
  });

  // Collect all endpoints with their polyline index and side
  const endpoints = [];
  for (let i = 0; i < polylines.length; i++) {
    const pl = polylines[i];
    if (pl.length < 2 || !plInfo[i]) continue;
    endpoints.push({ x: pl[0].x, y: pl[0].y, idx: i, side: 0 });
    endpoints.push({ x: pl[pl.length - 1].x, y: pl[pl.length - 1].y, idx: i, side: 1 });
  }

  // Check if an endpoint is already connected to another polyline
  const isConnected = (ep) => {
    for (const other of endpoints) {
      if (other.idx === ep.idx) continue;
      const d = Math.sqrt((ep.x - other.x) ** 2 + (ep.y - other.y) ** 2);
      if (d < snapTol) return true;
    }
    return false;
  };

  const used = new Set();
  const newPolylines = [];
  const newThicknesses = [];

  for (let i = 0; i < polylines.length; i++) {
    if (!plInfo[i]) continue;
    const plA = polylines[i];

    for (let ei = 0; ei < 2; ei++) {
      const epA = ei === 0 ? plA[0] : plA[plA.length - 1];
      const keyA = `${i}_${ei}`;
      if (used.has(keyA)) continue;
      if (isConnected({ x: epA.x, y: epA.y, idx: i })) continue;

      // Find a parallel segment with a close free endpoint
      for (let j = i + 1; j < polylines.length; j++) {
        if (!plInfo[j] || plInfo[j].dir !== plInfo[i].dir) continue;
        const plB = polylines[j];

        for (let ej = 0; ej < 2; ej++) {
          const epB = ej === 0 ? plB[0] : plB[plB.length - 1];
          const keyB = `${j}_${ej}`;
          if (used.has(keyB)) continue;
          if (isConnected({ x: epB.x, y: epB.y, idx: j })) continue;

          // Check distance and perpendicular offset
          const dist = Math.sqrt((epA.x - epB.x) ** 2 + (epA.y - epB.y) ** 2);
          if (dist > maxStepDist || dist < 3) continue;

          // Must have perpendicular offset (parallel but shifted)
          let perpOffset, alongOffset;
          if (plInfo[i].dir === "H") {
            perpOffset = Math.abs(epA.y - epB.y); // different Y = offset
            alongOffset = Math.abs(epA.x - epB.x);
          } else {
            perpOffset = Math.abs(epA.x - epB.x); // different X = offset
            alongOffset = Math.abs(epA.y - epB.y);
          }
          // Must be mostly perpendicular (step), not mostly along (gap)
          if (perpOffset < 3 || alongOffset > perpOffset * 2) continue;

          // Verify dark pixels along the orthogonal connector
          const pA = { x: epA.x, y: epA.y };
          const pB = { x: epB.x, y: epB.y };
          if (!_isSegmentOnWall(pA, pB, mask, w, h)) continue;

          // Scan the full extent of the dark band beyond both endpoints.
          // The band is orthogonal to the parallel segments' axis.
          const midY = (epA.y + epB.y) / 2;
          const midX = (epA.x + epB.x) / 2;
          let extStart, extEnd;

          if (plInfo[i].dir === "V") {
            // Parallel V segments → connecting band is horizontal (scan X)
            const scanY = Math.round(midY);
            const minX = Math.min(epA.x, epB.x);
            const maxX = Math.max(epA.x, epB.x);
            // Scan left from min endpoint
            extStart = Math.round(minX);
            for (let sx = extStart - 1; sx >= Math.max(0, extStart - maxStepDist); sx--) {
              if (sx >= 0 && sx < w && scanY >= 0 && scanY < h && mask[scanY * w + sx]) {
                extStart = sx;
              } else break;
            }
            // Scan right from max endpoint
            extEnd = Math.round(maxX);
            for (let sx = extEnd + 1; sx < Math.min(w, extEnd + maxStepDist); sx++) {
              if (sx >= 0 && sx < w && scanY >= 0 && scanY < h && mask[scanY * w + sx]) {
                extEnd = sx;
              } else break;
            }
          } else {
            // Parallel H segments → connecting band is vertical (scan Y)
            const scanX = Math.round(midX);
            const minY = Math.min(epA.y, epB.y);
            const maxY = Math.max(epA.y, epB.y);
            extStart = Math.round(minY);
            for (let sy = extStart - 1; sy >= Math.max(0, extStart - maxStepDist); sy--) {
              if (scanX >= 0 && scanX < w && sy >= 0 && sy < h && mask[sy * w + scanX]) {
                extStart = sy;
              } else break;
            }
            extEnd = Math.round(maxY);
            for (let sy = extEnd + 1; sy < Math.min(h, extEnd + maxStepDist); sy++) {
              if (scanX >= 0 && scanX < w && sy >= 0 && sy < h && mask[sy * w + scanX]) {
                extEnd = sy;
              } else break;
            }
          }

          // Build polyline: [extension start] → epA → epB → [extension end]
          // Only add extension if it extends beyond the parallel segment's half-width
          const halfWidthA = (thicknesses[i] || 20) / 2;
          const halfWidthB = (thicknesses[j] || 20) / 2;
          const points = [];
          if (plInfo[i].dir === "V") {
            const scanY = Math.round(midY);
            const minEp = Math.min(epA.x, epB.x), maxEp = Math.max(epA.x, epB.x);
            const startMargin = epA.x < epB.x ? halfWidthA : halfWidthB;
            const endMargin = epA.x < epB.x ? halfWidthB : halfWidthA;
            if (minEp - extStart > startMargin + 2) {
              points.push({ x: extStart, y: scanY });
            }
            if (epA.x <= epB.x) { points.push(pA, pB); } else { points.push(pB, pA); }
            if (extEnd - maxEp > endMargin + 2) {
              points.push({ x: extEnd, y: scanY });
            }
          } else {
            const scanX = Math.round(midX);
            const minEp = Math.min(epA.y, epB.y), maxEp = Math.max(epA.y, epB.y);
            const startMargin = epA.y < epB.y ? halfWidthA : halfWidthB;
            const endMargin = epA.y < epB.y ? halfWidthB : halfWidthA;
            if (minEp - extStart > startMargin + 2) {
              points.push({ x: scanX, y: extStart });
            }
            if (epA.y <= epB.y) { points.push(pA, pB); } else { points.push(pB, pA); }
            if (extEnd - maxEp > endMargin + 2) {
              points.push({ x: scanX, y: extEnd });
            }
          }

          if (points.length < 2) continue;

          // Measure thickness at midpoint
          const mx = Math.round((epA.x + epB.x) / 2);
          const my = Math.round((epA.y + epB.y) / 2);
          let thickness = 20;
          if (mx >= 0 && mx < w && my >= 0 && my < h) {
            const dt = distMat.floatAt(my, mx) * 2;
            if (dt > 1) thickness = dt;
          }

          console.log(`[step] detected: ${points.length} pts, (${points.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(' → ')})`);

          newPolylines.push(points);
          newThicknesses.push(thickness);
          used.add(keyA);
          used.add(keyB);
          break;
        }
        if (used.has(keyA)) break;
      }
    }
  }

  // Append new connectors
  polylines.push(...newPolylines);
  thicknesses.push(...newThicknesses);
}

/** Insert a shared point on a polyline at a given coordinate along its main axis. */
function _insertPointOnPolylineAtCoord(pl, axis, coordVal, perpPos, tol) {
  // Check if a point already exists near this coordinate
  for (const p of pl) {
    if (Math.abs(p[axis] - coordVal) < tol) return; // already has a point there
  }
  // Find the segment that spans this coordinate and insert
  for (let k = 0; k < pl.length - 1; k++) {
    const a = pl[k][axis], b = pl[k + 1][axis];
    const min = Math.min(a, b), max = Math.max(a, b);
    if (coordVal >= min - tol && coordVal <= max + tol) {
      const newPt = axis === "x"
        ? { x: coordVal, y: perpPos }
        : { x: perpPos, y: coordVal };
      pl.splice(k + 1, 0, newPt);
      return;
    }
  }
}

/** Remove segments from `segs` that overlap with any segment in `refSegs` (same axis, close position). */
function _removeOverlappingSegments(segs, refSegs, posTol) {
  if (refSegs.length === 0) return segs;
  return segs.filter(seg => {
    for (const ref of refSegs) {
      // Same position (within tolerance) and overlapping range
      if (Math.abs(seg.position - ref.position) <= posTol) {
        const overlapStart = Math.max(seg.start, ref.start);
        const overlapEnd = Math.min(seg.end, ref.end);
        if (overlapEnd > overlapStart) {
          // Overlap ratio — reject if most of the segment overlaps
          const overlapLen = overlapEnd - overlapStart;
          const segLen = seg.end - seg.start;
          if (segLen > 0 && overlapLen / segLen > 0.5) return false;
        }
      }
    }
    return true;
  });
}

function _classifyPeripheral(segments, roomMask, w, h, axis, distMat, meterByPx) {
  const peripheral = [], interior = [];
  const sampleCount = 10;
  const minPeripheralLen = meterByPx > 0 ? Math.round(0.20 / meterByPx) : 30;

  for (const seg of segments) {
    // Short segments default to interior — probe sampling is unreliable
    const segLen = seg.end - seg.start;
    if (segLen < minPeripheralLen) { interior.push(seg); continue; }
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

    // Probe beyond the wall on both sides — check room mask (polygon index)
    // Peripheral = different polygon indices (or 0 = outside) on the two sides.
    // Interior = same polygon index on both sides.
    const probeOffset = halfWidth + 15;
    let samePolygon = 0, diffPolygon = 0;

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

      // Get polygon index on each side (0 = outside any polygon)
      const idxA = (pxA >= 0 && pxA < w && pyA >= 0 && pyA < h) ? roomMask[pyA * w + pxA] : 0;
      const idxB = (pxB >= 0 && pxB < w && pyB >= 0 && pyB < h) ? roomMask[pyB * w + pxB] : 0;

      if (idxA !== idxB) {
        diffPolygon++;
      } else {
        samePolygon++;
      }
    }

    // Peripheral if enough samples show different polygon indices on each side
    const asymThreshold = sampleCount * 0.4;
    if (diffPolygon >= asymThreshold) {
      peripheral.push(seg);
    } else {
      interior.push(seg);
    }
  }

  return { peripheral, interior };
}

/**
 * Phase 1.1b: Close the peripheral envelope by connecting free endpoints
 * of peripheral walls through non-ortho paths (curves, obliques).
 *
 * 1. Find "free" endpoints — connected to only 1 polyline
 * 2. Pair them by greedy nearest neighbor
 * 3. Connect each pair with a straight line
 */
function _closePeripheralEnvelope(polylines, thicknesses, ctx) {
  const { wWidth, wHeight, distMat, meterByPx, cutPolygons } = ctx;
  const resultPolylines = [];
  const resultThicknesses = [];

  if (polylines.length < 2) return { polylines: resultPolylines, thicknesses: resultThicknesses };

  // 1. Collect all endpoints, identify free ones (not shared with another polyline)
  const snapTol = meterByPx > 0 ? Math.max(5, Math.round(0.15 / meterByPx)) : 15;
  const allEndpoints = [];

  for (let i = 0; i < polylines.length; i++) {
    const pl = polylines[i];
    if (pl.length < 2) continue;
    allEndpoints.push({ x: pl[0].x, y: pl[0].y, polyIdx: i, side: "start" });
    allEndpoints.push({ x: pl[pl.length - 1].x, y: pl[pl.length - 1].y, polyIdx: i, side: "end" });
  }

  const freeEndpoints = [];
  for (const ep of allEndpoints) {
    let connected = false;
    for (const other of allEndpoints) {
      if (other.polyIdx === ep.polyIdx) continue;
      const dist = Math.sqrt((ep.x - other.x) ** 2 + (ep.y - other.y) ** 2);
      if (dist < snapTol) { connected = true; break; }
    }
    if (!connected) freeEndpoints.push(ep);
  }

  console.log(`[envelope] ${freeEndpoints.length} free endpoints (snapTol=${snapTol}), ${(cutPolygons || []).length} cut polygons`);
  for (const ep of freeEndpoints) {
    console.log(`  free: (${Math.round(ep.x)}, ${Math.round(ep.y)}) poly=${ep.polyIdx} ${ep.side}`);
  }

  if (freeEndpoints.length < 2) return { polylines: resultPolylines, thicknesses: resultThicknesses };

  // 2. Greedy nearest-neighbor pairing
  const used = new Set();
  const defaultThickness = thicknesses.length > 0
    ? thicknesses.reduce((a, b) => a + b, 0) / thicknesses.length : 20;
  const rdpTol = meterByPx > 0 ? Math.max(3, Math.round(0.03 / meterByPx)) : 5;

  for (let i = 0; i < freeEndpoints.length; i++) {
    if (used.has(i)) continue;
    const epA = freeEndpoints[i];

    let bestJ = -1, bestDist = Infinity;
    for (let j = 0; j < freeEndpoints.length; j++) {
      if (i === j || used.has(j)) continue;
      if (freeEndpoints[j].polyIdx === epA.polyIdx) continue;
      const d = Math.sqrt((epA.x - freeEndpoints[j].x) ** 2 + (epA.y - freeEndpoints[j].y) ** 2);
      if (d < bestDist) { bestDist = d; bestJ = j; }
    }
    if (bestJ < 0) continue;

    const epB = freeEndpoints[bestJ];
    used.add(i);
    used.add(bestJ);

    // 3. Build refined path: resample along cut boundary, snap to medial axis,
    //    then fit as straight line or circular arc.
    const searchR = Math.round(defaultThickness * 0.75);

    // Determine H/V axis constraint for each endpoint
    const axisA = _getEndpointAxis(epA, polylines);
    const axisB = _getEndpointAxis(epB, polylines);

    // Get raw boundary path from cut polygon
    let rawPath = _traceAlongCutBoundary(epA, epB, cutPolygons || [], snapTol);
    if (!rawPath || rawPath.length < 2) {
      rawPath = [{ x: epA.x, y: epA.y }, { x: epB.x, y: epB.y }];
    }

    // Resample densely (~10px intervals) and snap each to medial axis
    const dense = _resamplePath(rawPath, 10);
    for (let k = 0; k < dense.length; k++) {
      dense[k] = _snapToMedialAxis(dense[k], distMat, wWidth, wHeight, searchR);
    }

    // Fit as line or arc, adjust endpoints on H/V axes
    const path = _fitLineOrArc(dense, epA, epB, axisA, axisB, defaultThickness);
    console.log(`[envelope] ${path._type}: (${Math.round(path[0].x)},${Math.round(path[0].y)}) → (${Math.round(path[path.length-1].x)},${Math.round(path[path.length-1].y)}) ${path.length} pts`);

    // Connect: slide the ortho wall endpoint along its axis to match the path endpoint
    const pathStart = path[0];
    const pathEnd = path[path.length - 1];

    const plA = polylines[epA.polyIdx];
    if (epA.side === "start") {
      plA[0] = { x: pathStart.x, y: pathStart.y };
    } else {
      plA[plA.length - 1] = { x: pathStart.x, y: pathStart.y };
    }

    const plB = polylines[epB.polyIdx];
    if (epB.side === "start") {
      plB[0] = { x: pathEnd.x, y: pathEnd.y };
    } else {
      plB[plB.length - 1] = { x: pathEnd.x, y: pathEnd.y };
    }

    // Thickness: use average of adjacent ortho wall thicknesses
    const thickA = thicknesses[epA.polyIdx] || defaultThickness;
    const thickB = thicknesses[epB.polyIdx] || defaultThickness;
    const thickness = (thickA + thickB) / 2;

    resultPolylines.push(path);
    resultThicknesses.push(thickness);
  }

  return { polylines: resultPolylines, thicknesses: resultThicknesses };
}

/**
 * Trace along a cut polygon boundary between two endpoints.
 * Finds the nearest cut polygon, projects both endpoints onto it,
 * and returns the shortest arc between the two projections.
 */
function _traceAlongCutBoundary(epA, epB, cutPolygons, snapTol) {
  if (!cutPolygons || cutPolygons.length === 0) return null;

  const mid = { x: (epA.x + epB.x) / 2, y: (epA.y + epB.y) / 2 };

  // Find the cut polygon closest to the midpoint of the two endpoints
  let bestPoly = null, bestPolyDist = Infinity;
  for (const poly of cutPolygons) {
    // Average distance from midpoint to polygon edges
    let minEdgeDist = Infinity;
    for (let k = 0; k < poly.length; k++) {
      const p1 = poly[k], p2 = poly[(k + 1) % poly.length];
      const d = _pointToSegmentDist(mid.x, mid.y, p1.x, p1.y, p2.x, p2.y);
      if (d < minEdgeDist) minEdgeDist = d;
    }
    if (minEdgeDist < bestPolyDist) {
      bestPolyDist = minEdgeDist;
      bestPoly = poly;
    }
  }

  if (!bestPoly) return null;

  // Project epA and epB onto the polygon edges — find closest edge + parameter
  const projA = _projectOntoPolygon(epA, bestPoly);
  const projB = _projectOntoPolygon(epB, bestPoly);
  if (!projA || !projB) return null;
  if (projA.edgeIdx === projB.edgeIdx && Math.abs(projA.t - projB.t) < 0.01) return null;

  // Extract the two possible arcs and pick the shorter one
  const n = bestPoly.length;
  const arc1 = _extractArc(bestPoly, projA, projB, 1);
  const arc2 = _extractArc(bestPoly, projA, projB, -1);

  const arcLen = (arc) => {
    let len = 0;
    for (let k = 1; k < arc.length; k++) {
      len += Math.sqrt((arc[k].x - arc[k - 1].x) ** 2 + (arc[k].y - arc[k - 1].y) ** 2);
    }
    return len;
  };

  const path = arcLen(arc1) <= arcLen(arc2) ? arc1 : arc2;

  return path;
}

/** Project a point onto the nearest edge of a polygon. Returns { edgeIdx, t, x, y }. */
function _projectOntoPolygon(pt, poly) {
  let bestDist = Infinity, bestResult = null;
  for (let k = 0; k < poly.length; k++) {
    const p1 = poly[k], p2 = poly[(k + 1) % poly.length];
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1) continue;
    let t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = p1.x + t * dx, py = p1.y + t * dy;
    const dist = Math.sqrt((pt.x - px) ** 2 + (pt.y - py) ** 2);
    if (dist < bestDist) {
      bestDist = dist;
      bestResult = { edgeIdx: k, t, x: px, y: py };
    }
  }
  return bestResult;
}

/** Extract an arc along polygon edges from projA to projB in given direction (1=forward, -1=backward). */
function _extractArc(poly, projA, projB, direction) {
  const n = poly.length;
  const arc = [];

  // Start from projA's projected point
  arc.push({ x: projA.x, y: projA.y });

  if (projA.edgeIdx === projB.edgeIdx) {
    // Same edge — just go from projA to projB directly
    if ((direction === 1 && projA.t <= projB.t) || (direction === -1 && projA.t >= projB.t)) {
      arc.push({ x: projB.x, y: projB.y });
      return arc;
    }
  }

  // Walk polygon vertices from projA's edge to projB's edge
  let edgeIdx = projA.edgeIdx;
  if (direction === 1) {
    // Forward: go to end of current edge, then walk vertices forward
    edgeIdx = (edgeIdx + 1) % n;
    for (let steps = 0; steps < n; steps++) {
      arc.push({ x: poly[edgeIdx].x, y: poly[edgeIdx].y });
      if (edgeIdx === projB.edgeIdx) break;
      if (edgeIdx === (projB.edgeIdx + 1) % n) break;
      edgeIdx = (edgeIdx + 1) % n;
    }
  } else {
    // Backward: go to start of current edge, then walk vertices backward
    for (let steps = 0; steps < n; steps++) {
      arc.push({ x: poly[edgeIdx].x, y: poly[edgeIdx].y });
      if (edgeIdx === projB.edgeIdx) break;
      if (edgeIdx === (projB.edgeIdx + 1) % n) break;
      edgeIdx = (edgeIdx - 1 + n) % n;
    }
  }

  arc.push({ x: projB.x, y: projB.y });
  return arc;
}

/** Distance from point (px,py) to segment (ax,ay)-(bx,by). */
function _pointToSegmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

/** Determine if an endpoint's connected wall is H or V. Returns "H", "V", or null. */
function _getEndpointAxis(ep, polylines) {
  const pl = polylines[ep.polyIdx];
  if (!pl || pl.length < 2) return null;
  const p0 = ep.side === "start" ? pl[0] : pl[pl.length - 1];
  const p1 = ep.side === "start" ? pl[1] : pl[pl.length - 2];
  const dx = Math.abs(p1.x - p0.x), dy = Math.abs(p1.y - p0.y);
  if (dx > dy * 3) return "H";
  if (dy > dx * 3) return "V";
  return null;
}

/** Resample a path at regular intervals (approx stepPx pixels). */
function _resamplePath(path, stepPx) {
  if (path.length < 2) return [...path];
  // Compute cumulative distances
  const cumDist = [0];
  for (let i = 1; i < path.length; i++) {
    cumDist.push(cumDist[i - 1] + Math.sqrt(
      (path[i].x - path[i - 1].x) ** 2 + (path[i].y - path[i - 1].y) ** 2
    ));
  }
  const totalLen = cumDist[cumDist.length - 1];
  if (totalLen < stepPx) return [path[0], path[path.length - 1]];
  const nSamples = Math.max(2, Math.round(totalLen / stepPx));
  const result = [];
  for (let s = 0; s <= nSamples; s++) {
    const targetDist = (s / nSamples) * totalLen;
    // Find segment containing targetDist
    let seg = 0;
    while (seg < cumDist.length - 2 && cumDist[seg + 1] < targetDist) seg++;
    const segLen = cumDist[seg + 1] - cumDist[seg];
    const t = segLen > 0 ? (targetDist - cumDist[seg]) / segLen : 0;
    result.push({
      x: path[seg].x + t * (path[seg + 1].x - path[seg].x),
      y: path[seg].y + t * (path[seg + 1].y - path[seg].y),
    });
  }
  return result;
}

/**
 * Fit recentered points as either a straight line or a circular arc.
 * Adjusts endpoints to stay on H/V axes of connected ortho walls.
 */
function _fitLineOrArc(points, epA, epB, axisA, axisB, thickness) {
  if (points.length < 2) {
    const r = [{ x: epA.x, y: epA.y }, { x: epB.x, y: epB.y }];
    r._type = "line";
    return r;
  }

  // Adjust endpoints: snap to medial axis but keep on H/V axis
  const first = points[0], last = points[points.length - 1];
  const adjA = { x: first.x, y: first.y };
  const adjB = { x: last.x, y: last.y };
  if (axisA === "H") adjA.y = epA.y; // keep y, allow x to shift
  if (axisA === "V") adjA.x = epA.x; // keep x, allow y to shift
  if (axisB === "H") adjB.y = epB.y;
  if (axisB === "V") adjB.x = epB.x;

  // Check if points are roughly collinear → straight line
  const maxDeviation = _maxDeviationFromLine(points, adjA, adjB);
  if (maxDeviation < thickness * 0.5) {
    const result = [adjA, adjB];
    result._type = "line";
    return result;
  }

  // Fit a circle through 3 points (start, mid, end of recentered samples)
  const midIdx = Math.floor(points.length / 2);
  const circle = _fitCircle3Points(adjA, points[midIdx], adjB);

  if (circle) {
    // Validate: check all recentered points are close to the circle
    let maxErr = 0;
    for (const p of points) {
      const dr = Math.abs(Math.sqrt((p.x - circle.cx) ** 2 + (p.y - circle.cy) ** 2) - circle.r);
      if (dr > maxErr) maxErr = dr;
    }

    if (maxErr < thickness) {
      // Good circle fit — generate arc points
      const arcPts = _generateArcPoints(circle, adjA, adjB, points[midIdx], thickness);
      arcPts._type = "arc";
      return arcPts;
    }
  }

  // Fallback: use the recentered points with cleanup
  const cleaned = [adjA];
  const minDist = thickness * 1.5;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = cleaned[cleaned.length - 1];
    const d = Math.sqrt((points[i].x - prev.x) ** 2 + (points[i].y - prev.y) ** 2);
    if (d >= minDist) cleaned.push(points[i]);
  }
  cleaned.push(adjB);
  cleaned._type = "polyline";
  return cleaned;
}

/** Maximum perpendicular distance of any point from the line A→B. */
function _maxDeviationFromLine(points, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return 0;
  let maxDev = 0;
  for (const p of points) {
    const dev = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
    if (dev > maxDev) maxDev = dev;
  }
  return maxDev;
}

/** Fit a circle through 3 points. Returns { cx, cy, r } or null. */
function _fitCircle3Points(p1, p2, p3) {
  const ax = p1.x, ay = p1.y, bx = p2.x, by = p2.y, cx = p3.x, cy = p3.y;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-6) return null; // collinear
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const r = Math.sqrt((ax - ux) ** 2 + (ay - uy) ** 2);
  if (r > 50000) return null; // too large radius = nearly straight
  return { cx: ux, cy: uy, r };
}

/** Generate evenly-spaced points along a circular arc from pStart to pEnd passing through pMid. */
function _generateArcPoints(circle, pStart, pEnd, pMid, thickness) {
  const { cx, cy, r } = circle;
  let angStart = Math.atan2(pStart.y - cy, pStart.x - cx);
  let angEnd = Math.atan2(pEnd.y - cy, pEnd.x - cx);
  const angMid = Math.atan2(pMid.y - cy, pMid.x - cx);

  // Determine arc direction: ensure we go through pMid
  let sweep = angEnd - angStart;
  // Normalize to [-PI, PI]
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;

  // Check if midpoint is on this arc
  let testMid = angMid - angStart;
  while (testMid > Math.PI) testMid -= 2 * Math.PI;
  while (testMid < -Math.PI) testMid += 2 * Math.PI;

  if ((sweep > 0 && (testMid < 0 || testMid > sweep)) ||
      (sweep < 0 && (testMid > 0 || testMid < sweep))) {
    // Midpoint is on the other arc — flip direction
    if (sweep > 0) sweep -= 2 * Math.PI;
    else sweep += 2 * Math.PI;
  }

  // Generate points at ~thickness spacing along the arc
  const arcLen = Math.abs(sweep) * r;
  const nPts = Math.max(2, Math.round(arcLen / (thickness * 2)));
  const result = [];
  for (let i = 0; i <= nPts; i++) {
    const ang = angStart + (i / nPts) * sweep;
    result.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  // Force exact endpoints
  result[0] = { x: pStart.x, y: pStart.y };
  result[result.length - 1] = { x: pEnd.x, y: pEnd.y };
  return result;
}

/** Remove consecutive points that are too close, keeping first and last. */
function _removeClosePoints(path, minDist) {
  if (path.length <= 2) return path;
  const result = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1];
    const d = Math.sqrt((path[i].x - prev.x) ** 2 + (path[i].y - prev.y) ** 2);
    if (d >= minDist) result.push(path[i]);
  }
  result.push(path[path.length - 1]);
  return result;
}

/** Snap a point to the local maximum of the distance transform (wall medial axis). */
function _snapToMedialAxis(point, distMat, w, h, searchRadius) {
  const px = Math.round(point.x), py = Math.round(point.y);
  let bestX = px, bestY = py, bestVal = 0;
  const r = Math.max(3, searchRadius);
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const nx = px + dx, ny = py + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const val = distMat.floatAt(ny, nx);
      if (val > bestVal) { bestVal = val; bestX = nx; bestY = ny; }
    }
  }
  return { x: bestX, y: bestY };
}

/**
 * Trace a path through the wall mask from point A to point B,
 * following the medial axis (highest distance transform values).
 * Uses A* with cost inversely weighted by distance transform.
 */
function _traceWallPath(epA, epB, mask, distMat, w, h, maxDist) {
  const sx = Math.max(0, Math.min(w - 1, Math.round(epA.x)));
  const sy = Math.max(0, Math.min(h - 1, Math.round(epA.y)));
  const ex = Math.max(0, Math.min(w - 1, Math.round(epB.x)));
  const ey = Math.max(0, Math.min(h - 1, Math.round(epB.y)));

  // Snap start/end to nearest mask pixel (spiral search)
  const snapRadius = Math.min(20, Math.round(maxDist * 0.05));
  const _snapToMask = (px, py) => {
    if (px >= 0 && px < w && py >= 0 && py < h && mask[py * w + px]) return { x: px, y: py };
    for (let r = 1; r <= snapRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = px + dx, ny = py + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && mask[ny * w + nx]) return { x: nx, y: ny };
        }
      }
    }
    return null;
  };

  const snappedStart = _snapToMask(sx, sy);
  const snappedEnd = _snapToMask(ex, ey);
  if (!snappedStart || !snappedEnd) return null;

  const step = 1;
  const goalTol = 3;
  const visited = new Uint8Array(w * h);
  const cameFrom = new Int32Array(w * h).fill(-1);
  const gScore = new Float32Array(w * h).fill(Infinity);

  const idx = (x, y) => y * w + x;
  const heuristic = (x, y) => Math.sqrt((x - snappedEnd.x) ** 2 + (y - snappedEnd.y) ** 2);

  const startIdx = idx(snappedStart.x, snappedStart.y);
  gScore[startIdx] = 0;

  // Binary min-heap priority queue
  const heap = [];
  const _heapPush = (node) => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].f <= heap[i].f) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };
  const _heapPop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let smallest = i;
        const l = 2 * i + 1, r = 2 * i + 2;
        if (l < heap.length && heap[l].f < heap[smallest].f) smallest = l;
        if (r < heap.length && heap[r].f < heap[smallest].f) smallest = r;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
        i = smallest;
      }
    }
    return top;
  };

  _heapPush({ x: snappedStart.x, y: snappedStart.y, f: heuristic(snappedStart.x, snappedStart.y) });

  const neighbors = [
    [-step, 0], [step, 0], [0, -step], [0, step],
    [-step, -step], [step, -step], [-step, step], [step, step]
  ];

  let iterations = 0;
  const maxIterations = Math.min((maxDist / step) * (maxDist / step), 2000000);

  while (heap.length > 0 && iterations < maxIterations) {
    iterations++;
    const current = _heapPop();

    const cx = current.x, cy = current.y;
    const ci = idx(cx, cy);

    if (visited[ci]) continue;
    visited[ci] = 1;

    // Goal reached (widened tolerance)
    if (Math.abs(cx - snappedEnd.x) <= goalTol && Math.abs(cy - snappedEnd.y) <= goalTol) {
      const path = [{ x: epB.x, y: epB.y }];
      let pi = ci;
      while (pi >= 0 && pi !== startIdx) {
        path.push({ x: pi % w, y: Math.floor(pi / w) });
        pi = cameFrom[pi];
      }
      path.push({ x: epA.x, y: epA.y });
      path.reverse();
      return path;
    }

    for (const [ndx, ndy] of neighbors) {
      const nx = cx + ndx, ny = cy + ndy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = idx(nx, ny);
      if (visited[ni]) continue;

      const moveCost = (ndx !== 0 && ndy !== 0) ? step * 1.414 : step;

      if (!mask[ni]) {
        // Off-mask grace zone near start/end — heavy penalty
        const distToStart = Math.abs(nx - snappedStart.x) + Math.abs(ny - snappedStart.y);
        const distToEnd = Math.abs(nx - snappedEnd.x) + Math.abs(ny - snappedEnd.y);
        if (distToStart > snapRadius && distToEnd > snapRadius) continue;
        const tentativeG = gScore[ci] + moveCost * 10;
        if (tentativeG < gScore[ni]) {
          gScore[ni] = tentativeG;
          cameFrom[ni] = ci;
          _heapPush({ x: nx, y: ny, f: tentativeG + heuristic(nx, ny) * 0.5 });
        }
        continue;
      }

      const distVal = distMat.floatAt(ny, nx);
      const wallWeight = distVal > 1 ? 1 / distVal : 5;
      const tentativeG = gScore[ci] + moveCost * wallWeight;

      if (tentativeG < gScore[ni]) {
        gScore[ni] = tentativeG;
        cameFrom[ni] = ci;
        _heapPush({ x: nx, y: ny, f: tentativeG + heuristic(nx, ny) * 0.5 });
      }
    }
  }

  return null;
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

  // Recenter grid lines using brightness-weighted centroid (original image).
  // Fixes binarization asymmetry (anti-aliasing shifting H lines upward).
  const { wBrightness } = ctx;
  if (wBrightness) {
    _recenterGridOnDarkCentroid(hGridLines, "H", wBrightness, wWidth, wHeight, hSegs);
    _recenterGridOnDarkCentroid(vGridLines, "V", wBrightness, wWidth, wHeight, vSegs);
  }

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

  // Remove stubs (but keep connectors linking two different walls)
  let resultPolylines = [], resultThicknesses = [];
  for (let i = 0; i < cleanResult.polylines.length; i++) {
    const pl = cleanResult.polylines[i];
    if (pl.length >= 2) {
      let totalLen = 0;
      for (let k = 1; k < pl.length; k++) totalLen += Math.sqrt((pl[k].x - pl[k - 1].x) ** 2 + (pl[k].y - pl[k - 1].y) ** 2);
      if (totalLen <= (cleanResult.thicknesses[i] || 0) * 1.0) {
        // Check if it connects two different walls → keep it (step connector)
        const pS = pl[0], pE = pl[pl.length - 1];
        let isConnector = false;
        const stubSnapDist = junctionSnapDist;
        for (let j = 0; j < cleanResult.polylines.length && !isConnector; j++) {
          if (j === i) continue;
          const other = cleanResult.polylines[j];
          let startNear = false, endNear = false;
          for (let k = 0; k < other.length - 1; k++) {
            const ax = other[k].x, ay = other[k].y, bx = other[k+1].x, by = other[k+1].y;
            const dx = bx-ax, dy = by-ay, lenSq = dx*dx+dy*dy;
            if (lenSq === 0) continue;
            const tS = Math.max(0, Math.min(1, ((pS.x-ax)*dx+(pS.y-ay)*dy)/lenSq));
            const dS = Math.sqrt((pS.x-ax-tS*dx)**2+(pS.y-ay-tS*dy)**2);
            if (dS <= stubSnapDist) startNear = true;
            const tE = Math.max(0, Math.min(1, ((pE.x-ax)*dx+(pE.y-ay)*dy)/lenSq));
            const dE = Math.sqrt((pE.x-ax-tE*dx)**2+(pE.y-ay-tE*dy)**2);
            if (dE <= stubSnapDist) endNear = true;
          }
          // Only one end touches this wall — check if other end touches a different wall
          if (startNear !== endNear) isConnector = true;
        }
        if (!isConnector) continue;
      }
    }
    resultPolylines.push(pl);
    resultThicknesses.push(cleanResult.thicknesses[i]);
  }

  // Zigzag removal
  const noZigzag = _removeZigzags(resultPolylines, resultThicknesses);

  // RDP simplification
  const rdpTolerance = meterByPx > 0 ? Math.max(3, Math.round(0.03 / meterByPx)) : 5;
  const rdpResult = _simplifyColinearPoints(noZigzag.polylines, noZigzag.thicknesses, rdpTolerance);

  // Step junctions (within grid context)
  const stepMaxGap = meterByPx > 0 ? Math.max(20, Math.round(1.5 / meterByPx)) : 150;
  const stepResult = _createStepJunctions(rdpResult.polylines, rdpResult.thicknesses, stepMaxGap, wWallMask, wWidth, wHeight, distMat, meterByPx);

  // Grid simplification
  const allGridLines = { h: hGridLines, v: vGridLines };
  const simplified = _simplifyPolylinesOnGrid(stepResult.polylines, allGridLines, gridTolerance, wWallMask, wWidth, wHeight);

  return { polylines: simplified, thicknesses: stepResult.thicknesses };
}

// ═══════════════════════════════════════════════════════════════════════
// Interior → Exterior connection
// ═══════════════════════════════════════════════════════════════════════

/**
 * Connect interior wall endpoints to exterior wall bodies.
 * Only creates int→ext junctions — no int↔int or ext↔ext modifications.
 *
 * For each interior endpoint, find the nearest exterior polyline segment body
 * and project the endpoint onto it. Insert the projected point into the
 * exterior polyline and snap the interior endpoint to match.
 */
function _connectInteriorToExterior(intPolylines, periPolylines, snapTol) {
  const projectOntoSegment = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { x: ax, y: ay, t: 0, dist: Math.sqrt((px - ax) ** 2 + (py - ay) ** 2) };
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const projX = ax + t * dx, projY = ay + t * dy;
    const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    return { x: projX, y: projY, t, dist };
  };

  // Determine interior polyline direction (H or V)
  const getDir = (pl) => {
    if (pl.length < 2) return null;
    const first = pl[0], last = pl[pl.length - 1];
    const dx = Math.abs(last.x - first.x), dy = Math.abs(last.y - first.y);
    return dy > dx * 2 ? "V" : dx > dy * 2 ? "H" : null;
  };

  // Check if an exterior segment is parallel to the interior wall direction
  const isParallel = (intDir, ax, ay, bx, by) => {
    const sdx = Math.abs(bx - ax), sdy = Math.abs(by - ay);
    const segDir = sdy > sdx * 2 ? "V" : sdx > sdy * 2 ? "H" : null;
    return intDir && segDir && intDir === segDir;
  };

  for (let i = 0; i < intPolylines.length; i++) {
    const intPl = intPolylines[i];
    if (intPl.length < 2) continue;
    const intDir = getDir(intPl);

    const endpoints = [
      { pt: intPl[0], idx: 0 },
      { pt: intPl[intPl.length - 1], idx: intPl.length - 1 },
    ];

    for (const { pt: ep } of endpoints) {
      let bestDist = snapTol;
      let bestMatch = null;
      let matchType = null; // "T" or "colinear"

      // ── Pass 1: T-junction on perpendicular exterior segments ──────
      for (let j = 0; j < periPolylines.length; j++) {
        const periPl = periPolylines[j];
        if (periPl.length < 2) continue;

        for (let k = 0; k < periPl.length - 1; k++) {
          const a = periPl[k], b = periPl[k + 1];

          // Skip segments parallel to the interior wall
          if (isParallel(intDir, a.x, a.y, b.x, b.y)) continue;

          const proj = projectOntoSegment(ep.x, ep.y, a.x, a.y, b.x, b.y);

          // Only match segment body (not near endpoints)
          if (proj.t < 0.01 || proj.t > 0.99) continue;
          if (proj.dist < bestDist) {
            bestDist = proj.dist;
            bestMatch = { j, k, x: proj.x, y: proj.y };
            matchType = "T";
          }
        }
      }

      // ── Pass 2: Colinear — slide endpoint along its axis to nearest
      //    exterior endpoint, if the endpoint falls within the exterior
      //    wall's axial range (i.e. the two walls overlap) ────────────
      if (!bestMatch && intDir) {
        let colinearBestDist = Infinity;
        for (let j = 0; j < periPolylines.length; j++) {
          const periPl = periPolylines[j];
          if (periPl.length < 2) continue;
          const periDir = getDir(periPl);
          if (periDir !== intDir) continue; // must be same axis

          // Check lateral distance between the two wall axes
          const periFirst = periPl[0], periLast = periPl[periPl.length - 1];
          const periAxisPos = intDir === "V"
            ? (periFirst.x + periLast.x) / 2
            : (periFirst.y + periLast.y) / 2;
          const intAxisPos = intDir === "V" ? ep.x : ep.y;
          if (Math.abs(intAxisPos - periAxisPos) > snapTol) continue;

          // Check if the interior endpoint falls within the exterior wall's axial range
          const periAxialMin = intDir === "V"
            ? Math.min(periFirst.y, periLast.y)
            : Math.min(periFirst.x, periLast.x);
          const periAxialMax = intDir === "V"
            ? Math.max(periFirst.y, periLast.y)
            : Math.max(periFirst.x, periLast.x);
          const epAxial = intDir === "V" ? ep.y : ep.x;

          // Endpoint must be within the exterior wall range (+ small tolerance)
          if (epAxial < periAxialMin - snapTol || epAxial > periAxialMax + snapTol) continue;

          // Find the nearest exterior endpoint on this polyline
          for (let k = 0; k < periPl.length; k++) {
            const periPt = periPl[k];
            const axialDist = intDir === "V"
              ? Math.abs(ep.y - periPt.y)
              : Math.abs(ep.x - periPt.x);
            if (axialDist < colinearBestDist) {
              colinearBestDist = axialDist;
              if (intDir === "V") {
                bestMatch = { j, k, x: ep.x, y: periPt.y };
              } else {
                bestMatch = { j, k, x: periPt.x, y: ep.y };
              }
              matchType = "colinear";
            }
          }
        }
      }

      if (!bestMatch) continue;

      if (matchType === "T") {
        const insertPt = {
          x: Math.round(bestMatch.x * 10) / 10,
          y: Math.round(bestMatch.y * 10) / 10,
        };

        // Check if a point already exists nearby in the exterior polyline
        const periPl = periPolylines[bestMatch.j];
        let alreadyExists = false;
        for (const pt of periPl) {
          if (Math.abs(pt.x - insertPt.x) < 2 && Math.abs(pt.y - insertPt.y) < 2) {
            ep.x = pt.x;
            ep.y = pt.y;
            alreadyExists = true;
            break;
          }
        }

        if (!alreadyExists) {
          // Insert projected point into exterior polyline
          periPl.splice(bestMatch.k + 1, 0, insertPt);
          // Snap interior endpoint to the inserted point
          ep.x = insertPt.x;
          ep.y = insertPt.y;
        }
      } else {
        // Colinear: slide interior endpoint along its own axis (keep its lateral position)
        ep.x = Math.round(bestMatch.x * 10) / 10;
        ep.y = Math.round(bestMatch.y * 10) / 10;
      }
    }
  }
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
function _insertJunctionPoints(polylines, thicknesses, snapTol, meterByPx) {
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

          // Small overshoot (< 25cm) = corner noise → truncate (replace endpoint).
          // Larger overshoot = real T-junction → insert intersection, keep extension.
          // Truncate threshold = max of the two wall thicknesses (not a fixed 25cm)
          const thickA = thicknesses[i] || 20, thickB = thicknesses[j] || 20;
          const maxTruncate = Math.max(thickA, thickB, meterByPx > 0 ? Math.round(0.25 / meterByPx) : 30);

          if (distAtoI <= maxTruncate) {
            epA.x = ix; epA.y = iy;
          } else {
            if (ei === 0) plA.unshift({ x: ix, y: iy });
            else plA.push({ x: ix, y: iy });
          }
          if (distBtoI <= maxTruncate) {
            epB.x = ix; epB.y = iy;
          } else {
            if (ej === 0) plB.unshift({ x: ix, y: iy });
            else plB.push({ x: ix, y: iy });
          }

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
      // H/V: need BOTH endpoints near the SAME long wall (not a connector).
      // If each endpoint touches a DIFFERENT long wall, it's a real connector (step junction).
      if (startNearLong && endNearLong) {
        // Check if both endpoints are near the same polyline
        let sameWall = false;
        for (let j = 0; j < polylines.length; j++) {
          if (j === i || lengths[j] < minLongLen) continue;
          const other = polylines[j];
          const dStart = ptPolyDist(pStart.x, pStart.y, other);
          const dEnd = ptPolyDist(pEnd.x, pEnd.y, other);
          if (dStart <= snapDist && dEnd <= snapDist) { sameWall = true; break; }
        }
        if (sameWall) keep[i] = false;
        // If each end touches a different wall → keep (connector between walls)
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

/**
 * Recenter each grid line using brightness-weighted centroid from the original image.
 * Darker pixels weigh more → finds the true center of the wall line,
 * accounting for anti-aliasing gradients that bias the binary threshold.
 */
function _recenterGridOnDarkCentroid(gridLines, axis, brightness, w, h, segs) {
  const searchRadius = 20;
  const darkThreshold = 200; // include anti-aliased pixels in the centroid
  for (let g = 0; g < gridLines.length; g++) {
    const pos = gridLines[g];
    const matchingSegs = segs.filter(s => s.position === pos);
    if (matchingSegs.length === 0) continue;

    // Sample along the segments on this grid line
    const sampleTs = [];
    for (const seg of matchingSegs) {
      const len = seg.end - seg.start;
      for (let s = 0; s < 10; s++) {
        sampleTs.push(Math.round(seg.start + (s + 0.5) * len / 10));
      }
    }

    // Compute brightness-weighted centroid perpendicular to the grid line
    let centroidSum = 0, weightSum = 0;
    for (const t of sampleTs) {
      for (let offset = -searchRadius; offset <= searchRadius; offset++) {
        const testPos = pos + offset;
        let px, py;
        if (axis === "H") {
          px = Math.min(w - 1, Math.max(0, t)); py = testPos;
          if (py < 0 || py >= h) continue;
        } else {
          px = testPos; py = Math.min(h - 1, Math.max(0, t));
          if (px < 0 || px >= w) continue;
        }
        const b = brightness[py * w + px];
        if (b < darkThreshold) {
          const weight = darkThreshold - b; // darker = higher weight
          centroidSum += testPos * weight;
          weightSum += weight;
        }
      }
    }

    if (weightSum > 0) {
      const centroid = Math.round(centroidSum / weightSum);
      if (centroid !== pos) {
        gridLines[g] = centroid;
        for (const seg of matchingSegs) seg.position = centroid;
      }
    }
  }
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
