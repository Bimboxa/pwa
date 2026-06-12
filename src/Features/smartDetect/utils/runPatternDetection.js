import cv from "Features/opencv/services/opencvService";
import applyPasteTransformToPoints from "Features/mapEditor/utils/applyPasteTransformToPoints";

/**
 * Find every region of the basemap that matches the copied annotation's
 * image patch, and build, for each hit, the placed annotation geometry
 * (REFERENCE space) so it can be previewed and bulk-committed.
 *
 * GLOBAL: scan the whole image once.
 * HOVER : scan only `window` (source-pixel sub-rect around the cursor),
 *         then offset matches back by the window origin.
 *
 * Returns { matches: [{ targetCenter, polylines, point, score }] } where
 * coordinates are in REFERENCE space (same space as the paste preview /
 * pasteAnnotationService targetCenter).
 */

function cropImageData(src, win) {
  const W = src.width;
  const H = src.height;
  const x = Math.max(0, Math.floor(win.x));
  const y = Math.max(0, Math.floor(win.y));
  const w = Math.min(W - x, Math.ceil(win.width));
  const h = Math.min(H - y, Math.ceil(win.height));
  if (w < 2 || h < 2) return null;
  const out = new Uint8ClampedArray(w * h * 4);
  const sd = src.data;
  for (let row = 0; row < h; row++) {
    const sStart = ((y + row) * W + x) * 4;
    out.set(sd.subarray(sStart, sStart + w * 4), row * w * 4);
  }
  return { imageData: new ImageData(out, w, h), x, y };
}

// Existing annotations act as masks = zones invisible to detection: paint
// their pixels white in the haystack so the template score collapses there
// and no match can land on an already-annotated motif. `originX/Y` offset
// mask lookups when the haystack is a window crop of the full image.
function whitenMaskedPixels(imageData, mask, maskWidth, originX, originY) {
  const { width, height, data } = imageData;
  for (let row = 0; row < height; row++) {
    const maskRowStart = (originY + row) * maskWidth + originX;
    for (let col = 0; col < width; col++) {
      if (mask[maskRowStart + col]) {
        const i = (row * width + col) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
  }
}

function buildPlacedGeometry(clipboard, pasteTransform, targetCenter) {
  // Pattern detection is single-template only (gated upstream to items.length===1).
  const item = clipboard.items?.[0];
  const type = item?.annotation?.type;
  const sc = clipboard.sourceCenter;
  const polylines = [];
  let point = null;

  if (type === "POLYGON" || type === "POLYLINE" || type === "STRIP") {
    const pts = applyPasteTransformToPoints(
      item.basePoints || [],
      sc,
      targetCenter,
      pasteTransform,
    );
    polylines.push({ points: pts, closed: type === "POLYGON" });
    if (type === "POLYGON" && item.baseCuts?.length) {
      for (const cut of item.baseCuts) {
        const cp = applyPasteTransformToPoints(
          cut.points || [],
          sc,
          targetCenter,
          pasteTransform,
        );
        polylines.push({ points: cp, closed: true });
      }
    }
  } else if (type === "POINT" || type === "MARKER") {
    const [p] = applyPasteTransformToPoints(
      [item.basePoint],
      sc,
      targetCenter,
      pasteTransform,
    );
    point = p;
  }
  return { polylines, point };
}

export default async function runPatternDetection({
  patternData,
  fullImageData,
  window,
  clipboard,
  pasteTransform,
  imageScale,
  imageOffset,
  threshold,
  maxMatches,
  sourceImgBox,
  exclusionMask,
  maskWidth,
  maskHeight,
}) {
  if (!patternData || !fullImageData || !clipboard) return { matches: [] };

  let haystack = fullImageData;
  let originX = 0;
  let originY = 0;
  if (window) {
    const crop = cropImageData(fullImageData, window);
    if (!crop) return { matches: [] };
    haystack = crop.imageData;
    originX = crop.x;
    originY = crop.y;
  }

  if (exclusionMask && maskWidth && maskHeight) {
    if (haystack === fullImageData) {
      // GLOBAL: fullImageData is the caller's cached ImageData — whiten a
      // copy, never the cache. The HOVER crop is already a fresh buffer.
      haystack = new ImageData(
        new Uint8ClampedArray(haystack.data),
        haystack.width,
        haystack.height,
      );
    }
    whitenMaskedPixels(haystack, exclusionMask, maskWidth, originX, originY);
  }

  let res;
  try {
    await cv.load();
    res = await cv.findPattern({
      patternData,
      imageData: haystack,
      ...(threshold != null ? { threshold } : {}),
      ...(maxMatches != null ? { maxMatches } : {}),
    });
  } catch (e) {
    console.warn("[patternDetection] findPattern failed", e);
    return { matches: [] };
  }

  const rawMatches = res?.matches || [];
  const pw = res?.patternWidth ?? patternData.width;
  const ph = res?.patternHeight ?? patternData.height;

  const scale = imageScale || 1;
  const offset = imageOffset || { x: 0, y: 0 };

  // A candidate is rejected when an existing annotation already covers most
  // of it (sampled on a 3×3 grid over the match rect). Existing + freshly
  // committed annotations thus act as a progressive screen.
  const isMaskedOut = (tlX, tlY) => {
    if (!exclusionMask || !maskWidth || !maskHeight) return false;
    let covered = 0;
    for (let gy = 0; gy < 3; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        const px = Math.floor(tlX + ((gx + 0.5) / 3) * pw);
        const py = Math.floor(tlY + ((gy + 0.5) / 3) * ph);
        if (px < 0 || py < 0 || px >= maskWidth || py >= maskHeight) continue;
        if (exclusionMask[py * maskWidth + px]) covered++;
      }
    }
    return covered >= 5; // majority of the 9 samples
  };

  // HOVER (windowed) is a single-target tool: keep only the match closest
  // to the cursor (= window centre), not every pattern in the window.
  const singleClosest = !!window;
  const winCx = window ? window.x + window.width / 2 : 0;
  const winCy = window ? window.y + window.height / 2 : 0;

  const matches = [];
  for (const m of rawMatches) {
    const tlX = originX + m.x;
    const tlY = originY + m.y;

    // Skip the copied annotation itself — its own patch matches at ~1.0
    // exactly where it sits, which would paste a duplicate on top.
    if (
      sourceImgBox &&
      Math.abs(tlX - sourceImgBox.x) < pw * 0.5 &&
      Math.abs(tlY - sourceImgBox.y) < ph * 0.5
    ) {
      continue;
    }

    // Skip candidates already covered by an existing annotation.
    if (isMaskedOut(tlX, tlY)) continue;

    const centerImgPx = {
      x: tlX + pw / 2,
      y: tlY + ph / 2,
    };
    const targetCenter = {
      x: centerImgPx.x * scale + offset.x,
      y: centerImgPx.y * scale + offset.y,
    };
    const geom = buildPlacedGeometry(clipboard, pasteTransform, targetCenter);
    const entry = { targetCenter, ...geom, score: m.score };

    if (singleClosest) {
      const d2 =
        (centerImgPx.x - winCx) ** 2 + (centerImgPx.y - winCy) ** 2;
      if (!matches.length || d2 < matches[0]._d2) {
        matches[0] = { ...entry, _d2: d2 };
      }
    } else {
      matches.push(entry);
    }
  }

  if (singleClosest && matches.length) {
    // eslint-disable-next-line no-unused-vars
    const { _d2, ...only } = matches[0];
    return { matches: [only] };
  }

  return { matches };
}
