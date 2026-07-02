import applyPasteTransformToPoints from "Features/mapEditor/utils/applyPasteTransformToPoints";
import { getBrightness } from "./stripDetectionHelpers";

/**
 * Paste "Ajuster" (J) mode — compute ONE best paste candidate around the
 * cursor by maximizing the dark pixels under the copied shape.
 *
 * - POLYGON: translation-only search; score = dark pixels under the FILLED
 *   surface (cuts excluded via evenodd rasterization).
 * - 2-pt POLYLINE / 2-pt STRIP: 3-parameter search (normal offset t,
 *   endpoint axial shifts e1/e2) maximizing dark coverage of the stroke
 *   band, then a recentering pass on the dark band along the normal.
 *
 * All scoring happens in SOURCE-IMAGE pixel space; input cursor and output
 * geometry are in REFERENCE space (same space as clipboard basePoints).
 * Pixels covered by the exclusion mask are skipped (neither dark nor light),
 * so existing annotations screen the search like they do for A / S modes.
 */

const DARK_THRESHOLD = 128;
const MIN_POLY_DARK_FRACTION = 0.1;
const MIN_POLY_DARK_SAMPLES = 8;
const MIN_SEG_DARK_DENSITY = 0.3;
const MAX_INTERIOR_SAMPLES = 1200;
const MAX_CENTERING_SAMPLES = 100000;
const MAX_AXIAL_SAMPLES = 500;
const MAX_CROSS_SAMPLES = 30;
const RECENTER_SCANLINES = 15;
const STRIP_DEFAULT_WIDTH_PX = 20;

// The J option only applies to single-item clipboards whose shape has a
// well-defined "dark pixels under it" score.
export function isPasteAdjustEligible(clipboard) {
  if (clipboard?.items?.length !== 1) return false;
  const item = clipboard.items[0];
  const type = item?.annotation?.type;
  if (type === "POLYGON") return (item.basePoints?.length ?? 0) >= 3;
  if (type === "POLYLINE" || type === "STRIP")
    return item.basePoints?.length === 2;
  return false;
}

export default function adjustPasteCandidate({
  clipboard,
  pasteTransform,
  cursorRef,
  imageData,
  exclusionMask,
  imageScale = 1,
  imageOffset = { x: 0, y: 0 },
  meterByPx = 0,
  smartZoom = 1,
  sourceBboxImgPx = null,
  darknessThreshold = DARK_THRESHOLD,
}) {
  if (!isPasteAdjustEligible(clipboard) || !imageData || !cursorRef)
    return null;

  const item = clipboard.items[0];
  const type = item.annotation.type;
  const scale = imageScale || 1;
  const offset = imageOffset || { x: 0, y: 0 };
  const zoom = smartZoom || 1;

  const toImgPx = (p) => ({
    ...p,
    x: (p.x - offset.x) / scale,
    y: (p.y - offset.y) / scale,
  });
  const toRef = (p) => ({
    ...p,
    x: p.x * scale + offset.x,
    y: p.y * scale + offset.y,
  });

  const { width: W, height: H } = imageData;

  // 1 = dark, 0 = light, null = skipped (out of bounds or masked).
  const sampleDark = (x, y) => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= W || py >= H) return null;
    if (exclusionMask && exclusionMask[py * W + px]) return null;
    return getBrightness(imageData, px, py) < darknessThreshold ? 1 : 0;
  };

  // Place the copy at the cursor (rotation / flip resolved once here — the
  // search itself is translation-only in placed space).
  const placedRef = applyPasteTransformToPoints(
    item.basePoints,
    clipboard.sourceCenter,
    cursorRef,
    pasteTransform
  );
  if (!placedRef.length) return null;

  // Prevent snapping back onto the copied annotation itself.
  const overlapsSource = (bboxImg) => {
    if (!sourceBboxImgPx) return false;
    return (
      Math.abs(bboxImg.x - sourceBboxImgPx.x) < sourceBboxImgPx.width * 0.5 &&
      Math.abs(bboxImg.y - sourceBboxImgPx.y) < sourceBboxImgPx.height * 0.5
    );
  };

  if (type === "POLYGON") {
    return adjustPolygon({
      item,
      clipboard,
      pasteTransform,
      cursorRef,
      placedRef,
      toImgPx,
      sampleDark,
      scale,
      zoom,
      overlapsSource,
    });
  }
  return adjustSegment({
    item,
    type,
    placedRef,
    toImgPx,
    toRef,
    sampleDark,
    scale,
    zoom,
    meterByPx,
    imageData,
    exclusionMask,
    darknessThreshold,
    overlapsSource,
  });
}

// ---------------------------------------------------------------------------
// POLYGON — filled-surface dark count, translation-only coarse-to-fine scan
// ---------------------------------------------------------------------------

function getBbox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Rasterize the placed polygon (ring + cuts, evenodd) at reduced resolution:
// one canvas pixel per sample, so the canvas stays ~MAX_INTERIOR_SAMPLES big
// whatever the polygon size. Returns interior sample offsets vs bbox origin.
function buildInteriorOffsets(ringImg, cutsImg, bbox, stride) {
  const cw = Math.max(1, Math.ceil(bbox.width / stride) + 1);
  const ch = Math.max(1, Math.ceil(bbox.height / stride) + 1);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "white";
  ctx.scale(1 / stride, 1 / stride);
  ctx.translate(-bbox.x, -bbox.y);
  ctx.beginPath();
  const tracePath = (pts) => {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  };
  tracePath(ringImg);
  for (const cut of cutsImg) {
    if (cut.length >= 3) tracePath(cut);
  }
  ctx.fill("evenodd");

  const data = ctx.getImageData(0, 0, cw, ch).data;
  const offsets = [];
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      if (data[(cy * cw + cx) * 4] >= 128) {
        offsets.push({ ox: (cx + 0.5) * stride, oy: (cy + 0.5) * stride });
      }
    }
  }
  return offsets;
}

function adjustPolygon({
  item,
  clipboard,
  pasteTransform,
  cursorRef,
  placedRef,
  toImgPx,
  sampleDark,
  scale,
  zoom,
  overlapsSource,
}) {
  const ringImg = placedRef.map(toImgPx);
  const cutsRef = (item.baseCuts || []).map((cut) =>
    applyPasteTransformToPoints(
      cut.points || [],
      clipboard.sourceCenter,
      cursorRef,
      pasteTransform
    )
  );
  const cutsImg = cutsRef.map((pts) => pts.map(toImgPx));

  const bbox = getBbox(ringImg);
  if (bbox.width < 2 || bbox.height < 2) return null;
  const stride = Math.max(
    1,
    Math.ceil(Math.sqrt((bbox.width * bbox.height) / MAX_INTERIOR_SAMPLES))
  );
  const offsets = buildInteriorOffsets(ringImg, cutsImg, bbox, stride);
  if (offsets.length < 4) return null;

  const scoreAt = (dx, dy) => {
    let dark = 0;
    let sampled = 0;
    for (const o of offsets) {
      const s = sampleDark(bbox.x + o.ox + dx, bbox.y + o.oy + dy);
      if (s === null) continue;
      sampled++;
      dark += s;
    }
    return { dark, sampled };
  };

  const bboxDiag = Math.hypot(bbox.width, bbox.height);
  const R = Math.min(120, Math.max(8, 0.45 * bboxDiag)) / zoom;
  const coarse = Math.max(2, Math.round(R / 10));
  const steps = [coarse, Math.max(1, Math.round(coarse / 3)), 1];

  let best = { dx: 0, dy: 0, ...scoreAt(0, 0) };
  let radius = R;
  let center = { dx: 0, dy: 0 };
  for (let level = 0; level < steps.length; level++) {
    const step = steps[level];
    for (let dy = center.dy - radius; dy <= center.dy + radius; dy += step) {
      for (let dx = center.dx - radius; dx <= center.dx + radius; dx += step) {
        const { dark, sampled } = scoreAt(dx, dy);
        if (dark > best.dark) best = { dx, dy, dark, sampled };
      }
    }
    center = { dx: best.dx, dy: best.dy };
    radius = step;
  }

  // Centering pass: when the polygon is larger than the dark motif, the
  // dark-count score plateaus over a range of translations and the scan can
  // stop anywhere on the plateau. Recenter the polygon on the centroid of
  // the dark pixels it covers (its own interior centroid must land on the
  // dark centroid), iterating until stable. Runs on a DENSE sample set
  // (stride ~1) — the coarse stride used for the search quantizes the
  // centroid by ±stride/2, which is visible on thin motif borders.
  const strideFine = Math.max(
    1,
    Math.ceil(Math.sqrt((bbox.width * bbox.height) / MAX_CENTERING_SAMPLES))
  );
  const denseOffsets =
    strideFine < stride
      ? buildInteriorOffsets(ringImg, cutsImg, bbox, strideFine)
      : offsets;
  let interiorCx = 0;
  let interiorCy = 0;
  for (const o of denseOffsets) {
    interiorCx += o.ox;
    interiorCy += o.oy;
  }
  interiorCx = bbox.x + interiorCx / denseOffsets.length;
  interiorCy = bbox.y + interiorCy / denseOffsets.length;

  let cdx = best.dx;
  let cdy = best.dy;
  for (let iter = 0; iter < 5; iter++) {
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (const o of denseOffsets) {
      const x = bbox.x + o.ox + cdx;
      const y = bbox.y + o.oy + cdy;
      if (sampleDark(x, y) === 1) {
        sx += x;
        sy += y;
        count++;
      }
    }
    if (!count) break;
    const mx = sx / count - (interiorCx + cdx);
    const my = sy / count - (interiorCy + cdy);
    if (Math.abs(mx) < 0.25 && Math.abs(my) < 0.25) break;
    cdx += mx;
    cdy += my;
  }
  // Keep the centered placement only if it doesn't lose dark coverage (the
  // centroid pull can drift toward asymmetric dark surroundings).
  if (cdx !== best.dx || cdy !== best.dy) {
    const centered = scoreAt(cdx, cdy);
    if (centered.dark >= best.dark * 0.95) {
      best = { dx: cdx, dy: cdy, ...centered };
    }
  }

  // Acceptance gates: enough of the surface must be dark, and at least a
  // fifth of the samples must land on scorable pixels.
  if (
    !best.sampled ||
    best.sampled < offsets.length * 0.2 ||
    best.dark < MIN_POLY_DARK_SAMPLES ||
    best.dark / best.sampled < MIN_POLY_DARK_FRACTION
  ) {
    return null;
  }

  const bestBboxImg = {
    x: bbox.x + best.dx,
    y: bbox.y + best.dy,
    width: bbox.width,
    height: bbox.height,
  };
  if (overlapsSource(bestBboxImg)) return null;

  // Translation back in REFERENCE space (offsets cancel out, only scale).
  const dxRef = best.dx * scale;
  const dyRef = best.dy * scale;
  const shift = (p) => ({ ...p, x: p.x + dxRef, y: p.y + dyRef });
  const placedPoints = placedRef.map(shift);
  const placedCuts = cutsRef.map((pts) => ({ points: pts.map(shift) }));

  const refBbox = getBbox(placedPoints);
  return {
    targetCenter: {
      x: refBbox.x + refBbox.width / 2,
      y: refBbox.y + refBbox.height / 2,
    },
    placedPoints,
    placedCuts,
    polylines: [
      { points: placedPoints, closed: true },
      ...placedCuts
        .filter((c) => c.points.length >= 3)
        .map((c) => ({ points: c.points, closed: true })),
    ],
    point: null,
    score: best.dark / best.sampled,
  };
}

// ---------------------------------------------------------------------------
// Segment (2-pt POLYLINE / STRIP) — normal offset + endpoint shifts, then
// dark-band recentering along the normal
// ---------------------------------------------------------------------------

function getSegmentBandImgPx(item, type, meterByPx, imageScale) {
  if (type === "STRIP") {
    const w = Math.max(
      3,
      Math.abs(item.stripWidthPx ?? STRIP_DEFAULT_WIDTH_PX) / imageScale
    );
    const orientation = item.stripOrientation ?? 1;
    // STRIP band is one-sided: it spans [0, orientation * w] along the normal.
    return {
      w,
      crossStart: orientation > 0 ? 0 : -w,
      crossEnd: orientation > 0 ? w : 0,
      bandCenterOffset: (orientation * w) / 2,
    };
  }
  // POLYLINE stroke band, centered on the centerline. Same CM / PX unit
  // conversion as buildExclusionMask.
  const ann = item.annotation;
  const sw = ann.strokeWidth ?? 1;
  const swImgPx =
    ann.strokeWidthUnit === "CM" && meterByPx > 0
      ? Math.abs((sw * 0.01) / meterByPx / imageScale)
      : Math.abs(sw / imageScale);
  const w = Math.max(3, swImgPx);
  return { w, crossStart: -w / 2, crossEnd: w / 2, bandCenterOffset: 0 };
}

function adjustSegment({
  item,
  type,
  placedRef,
  toImgPx,
  toRef,
  sampleDark,
  scale,
  zoom,
  meterByPx,
  imageData,
  exclusionMask,
  darknessThreshold,
  overlapsSource,
}) {
  const p1 = toImgPx(placedRef[0]);
  const p2 = toImgPx(placedRef[1]);
  const L = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (L < 4) return null;
  const u = { x: (p2.x - p1.x) / L, y: (p2.y - p1.y) / L };
  const n = { x: -u.y, y: u.x };

  const { w, crossStart, crossEnd, bandCenterOffset } = getSegmentBandImgPx(
    item,
    type,
    meterByPx,
    scale
  );
  const crossStep = Math.max(1, (crossEnd - crossStart) / MAX_CROSS_SAMPLES);

  // dark − light over one cross-section of the band at `base`.
  const crossScore = (base) => {
    let score = 0;
    for (let c = crossStart; c <= crossEnd; c += crossStep) {
      const s = sampleDark(base.x + c * n.x, base.y + c * n.y);
      if (s === null) continue;
      score += s === 1 ? 1 : -1;
    }
    return score;
  };

  // dark / (dark + light) density over the whole band [a1, a2] × t.
  const bandStats = (a1, a2, t) => {
    const axStep = Math.max(1, (a2 - a1) / MAX_AXIAL_SAMPLES);
    let dark = 0;
    let total = 0;
    for (let a = a1; a <= a2; a += axStep) {
      const base = {
        x: p1.x + a * u.x + t * n.x,
        y: p1.y + a * u.y + t * n.y,
      };
      for (let c = crossStart; c <= crossEnd; c += crossStep) {
        const s = sampleDark(base.x + c * n.x, base.y + c * n.y);
        if (s === null) continue;
        total++;
        dark += s;
      }
    }
    return { dark, total, score: 2 * dark - total };
  };

  // The ghost's midpoint sits on the cursor (applyPasteTransformToPoints
  // centers the copy on it), so the cursor's axial coordinate is L/2. The
  // copied segment only provides the AXIS and the band width — the candidate
  // length is re-derived from the dark band under the mouse, so a long copy
  // can land as a shorter segment (and vice versa).
  const aCur = L / 2;
  const win = Math.min(L / 2, 60);

  // --- Pass A: normal offset t, scored on a window around the cursor ------
  const T = Math.max(4, Math.min(3 * w, 45) / zoom);
  const scanT = (t0, range, step) => {
    let bestT = t0;
    let bestScore = -Infinity;
    for (let t = t0 - range; t <= t0 + range; t += step) {
      const { score } = bandStats(aCur - win, aCur + win, t);
      if (score > bestScore) {
        bestScore = score;
        bestT = t;
      }
    }
    return bestT;
  };
  const coarseStep = Math.max(1, Math.round(w / 2));
  let t = scanT(0, T, coarseStep);
  t = scanT(t, coarseStep, 1);

  // --- Pass B: length from the cursor — walk both ways until the dark
  // drops. A small gap tolerance survives antialiasing / noise; the endpoint
  // stops on the last dark scanline (= the darkness drop / wall edge).
  const gapTol = Math.max(2, Math.round(w / 2));
  const maxExtension = Math.max(imageData.width, imageData.height);
  const crossAt = (a, tt) =>
    crossScore({ x: p1.x + a * u.x + tt * n.x, y: p1.y + a * u.y + tt * n.y });

  // Dark scanline nearest to the cursor along the axis (the cursor may sit
  // just off the band).
  const findSeed = (tt) => {
    for (let d = 0; d <= win; d++) {
      if (crossAt(aCur + d, tt) > 0) return aCur + d;
      if (d > 0 && crossAt(aCur - d, tt) > 0) return aCur - d;
    }
    return null;
  };

  const walk = (aStart, dir, tt) => {
    let last = aStart;
    let gap = 0;
    for (let step = 1; step <= maxExtension; step++) {
      const a = aStart + dir * step;
      if (crossAt(a, tt) > 0) {
        last = a;
        gap = 0;
      } else {
        gap++;
        if (gap > gapTol) break;
      }
    }
    return last;
  };

  // --- Pass C: center on the MAIN dark line, iterating with the walk ------
  // From the band-center of each scanline, find the dark band containing (or
  // nearest to) it; the MEDIAN of the center offsets tracks the main
  // longitudinal dark line while ignoring outliers (crossings, noise).
  const findBandCenterOffset = (origin) => {
    const maxDist = Math.round(2 * w);
    const isDarkAt = (dist) => {
      const px = Math.round(origin.x + dist * n.x);
      const py = Math.round(origin.y + dist * n.y);
      if (px < 0 || py < 0 || px >= imageData.width || py >= imageData.height)
        return false;
      if (exclusionMask && exclusionMask[py * imageData.width + px])
        return false;
      return getBrightness(imageData, px, py) < darknessThreshold;
    };
    // Nearest dark pixel from the probe (0 if the probe itself is dark).
    let seed = null;
    for (let dist = 0; dist <= maxDist; dist++) {
      if (isDarkAt(dist)) {
        seed = dist;
        break;
      }
      if (dist > 0 && isDarkAt(-dist)) {
        seed = -dist;
        break;
      }
    }
    if (seed === null) return null;
    // Expand to the band edges around the seed.
    let lo = seed;
    let hi = seed;
    while (hi - lo <= 2 * maxDist && isDarkAt(lo - 1)) lo--;
    while (hi - lo <= 2 * maxDist && isDarkAt(hi + 1)) hi++;
    return (lo + hi) / 2;
  };

  const medianBandOffset = (a1, a2, tt) => {
    const offs = [];
    for (let k = 0; k < RECENTER_SCANLINES; k++) {
      const a = a1 + ((k + 0.5) / RECENTER_SCANLINES) * (a2 - a1);
      const origin = {
        x: p1.x + a * u.x + (tt + bandCenterOffset) * n.x,
        y: p1.y + a * u.y + (tt + bandCenterOffset) * n.y,
      };
      const off = findBandCenterOffset(origin);
      if (off !== null) offs.push(off);
    }
    if (offs.length < RECENTER_SCANLINES / 3) return null;
    offs.sort((x, y) => x - y);
    return offs[Math.floor(offs.length / 2)];
  };

  // Walk → recenter → re-walk: each recentering can expose more (or less) of
  // the band, so iterate until the centering converges.
  let a1 = null;
  let a2 = null;
  for (let iter = 0; iter < 3; iter++) {
    const seed = findSeed(t);
    if (seed === null) return null;
    a1 = walk(seed, -1, t);
    a2 = walk(seed, +1, t);
    if (a2 - a1 < 4) return null;
    const med = medianBandOffset(a1, a2, t);
    if (med === null || Math.abs(med) < 0.3) break;
    t += Math.max(-w, Math.min(w, med));
  }

  // --- Acceptance -----------------------------------------------------------
  const { dark, total } = bandStats(a1, a2, t);
  if (!total || dark / total < MIN_SEG_DARK_DENSITY) return null;

  // --- Mask-overlap at junctions --------------------------------------------
  // When the walk stopped because the band runs into an already-annotated
  // zone (exclusion-mask pixels are "skipped", not light), the endpoint sits
  // at the mask edge — which is slightly larger than the drawn annotation, so
  // the committed copy would leave a small gap at the junction. Push those
  // endpoints (and ONLY those — a stop on a real darkness drop is left
  // untouched) 2 cm INTO the masked zone to guarantee an overlap.
  if (exclusionMask) {
    const overlapPx = meterByPx > 0 ? 0.02 / meterByPx / scale : w / 2;
    const crossMaskFraction = (a) => {
      let masked = 0;
      let totalSamples = 0;
      for (let cs = crossStart; cs <= crossEnd; cs += crossStep) {
        const px = Math.round(p1.x + a * u.x + (t + cs) * n.x);
        const py = Math.round(p1.y + a * u.y + (t + cs) * n.y);
        if (px < 0 || py < 0 || px >= imageData.width || py >= imageData.height)
          continue;
        totalSamples++;
        if (exclusionMask[py * imageData.width + px]) masked++;
      }
      return totalSamples ? masked / totalSamples : 0;
    };
    const stoppedOnMask = (aEnd, dir) => {
      for (let d = 1; d <= gapTol + 1; d++) {
        if (crossMaskFraction(aEnd + dir * d) >= 0.3) return true;
      }
      return false;
    };
    if (stoppedOnMask(a1, -1)) a1 -= overlapPx;
    if (stoppedOnMask(a2, +1)) a2 += overlapPx;
  }

  const q1 = { x: p1.x + a1 * u.x + t * n.x, y: p1.y + a1 * u.y + t * n.y };
  const q2 = { x: p1.x + a2 * u.x + t * n.x, y: p1.y + a2 * u.y + t * n.y };

  const candBbox = getBbox([q1, q2]);
  if (
    overlapsSource({
      x: candBbox.x,
      y: candBbox.y,
      width: Math.max(candBbox.width, w),
      height: Math.max(candBbox.height, w),
    })
  ) {
    return null;
  }

  const placedPoints = [
    { ...placedRef[0], ...toRef(q1) },
    { ...placedRef[1], ...toRef(q2) },
  ];
  // Show the actual band footprint, not just the centerline: one-sided for
  // STRIP, symmetric (±w/2) for the POLYLINE stroke.
  const polylines = [{ points: placedPoints, closed: false }];
  const [bandLo, bandHi] =
    type === "STRIP" ? [0, (item.stripOrientation ?? 1) * w] : [-w / 2, w / 2];
  polylines.push({
    points: [
      toRef({ x: q1.x + bandLo * n.x, y: q1.y + bandLo * n.y }),
      toRef({ x: q2.x + bandLo * n.x, y: q2.y + bandLo * n.y }),
      toRef({ x: q2.x + bandHi * n.x, y: q2.y + bandHi * n.y }),
      toRef({ x: q1.x + bandHi * n.x, y: q1.y + bandHi * n.y }),
    ],
    closed: true,
  });

  return {
    targetCenter: {
      x: (placedPoints[0].x + placedPoints[1].x) / 2,
      y: (placedPoints[0].y + placedPoints[1].y) / 2,
    },
    placedPoints,
    placedCuts: [],
    polylines,
    point: null,
    score: dark / total,
  };
}
