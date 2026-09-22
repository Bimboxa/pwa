// Pure math for a base map "frame change": the image is re-rendered from the
// same PDF page with a new crop rectangle and/or dpi, and every coordinate
// stored in the old image frame must land on the same drawing feature in the
// new one.
//
// Notation (see regenerateBaseMapFromPdfPageService):
//   W,H       pdfjs viewport of the (rotated) page at the OLD dpi
//   o, n      old / new crop origins in that viewport (px)
//   d = o - n translation, in OLD-dpi px
//   k         newDpi / oldDpi (uniform scale)
//   oldSize   old reference frame (refWidth / refHeight)
//   newSize   real rendered size of the new image (truncated canvas)
//
// Old image px p  ->  new image px p' = (p + d) * k
//
// N  : normalized [0..1] point (old frame) -> normalized (new frame)
// PX : reference-px value (old frame)      -> reference px (new frame)
// S  : px scalar (a length)                -> scaled length

const FULL_PAGE = { x1: 0, y1: 0, x2: 1, y2: 1 };

export function normalizeBbox(bbox) {
  if (!bbox) return FULL_PAGE;
  const { x1, y1, x2, y2 } = bbox;
  if (![x1, y1, x2, y2].every(Number.isFinite)) return FULL_PAGE;
  return { x1, y1, x2, y2 };
}

export function normalizeRotation(rotation) {
  const r = Number(rotation) || 0;
  return ((r % 360) + 360) % 360;
}

export default function buildFrameTransform({
  oldBbox,
  newBbox,
  viewportSize, // { width, height } at OLD dpi
  k = 1,
  oldSize, // { width, height }
  newSize, // { width, height }
}) {
  const ob = normalizeBbox(oldBbox);
  const nb = normalizeBbox(newBbox);
  const dx = (ob.x1 - nb.x1) * viewportSize.width;
  const dy = (ob.y1 - nb.y1) * viewportSize.height;

  const PXx = (x) => (x + dx) * k;
  const PXy = (y) => (y + dy) * k;
  const S = (v) => v * k;

  const N = (p) => ({
    x: PXx(p.x * oldSize.width) / newSize.width,
    y: PXy(p.y * oldSize.height) / newSize.height,
  });
  const PX = (p) => ({ x: PXx(p.x), y: PXy(p.y) });

  // Normalized lengths (bbox.width/height) scale by k and by the ratio of
  // the two frames.
  const NW = (w) => (w * oldSize.width * k) / newSize.width;
  const NH = (h) => (h * oldSize.height * k) / newSize.height;

  return { d: { x: dx, y: dy }, k, N, PX, S, NW, NH };
}
