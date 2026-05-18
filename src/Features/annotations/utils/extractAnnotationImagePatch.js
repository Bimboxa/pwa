/**
 * Crop the basemap image patch delimited by a copied annotation, to be used
 * as the reference template for cv.findPattern.
 *
 * Coordinate spaces (see InteractionLayer / runStripDetectionFromLoupe):
 *   - clipboard.basePoints / basePoint / sourceCenter are in REFERENCE space
 *     (resolved pixels = normalized × baseMap.getImageSize()).
 *   - The source bitmap (`sourceImageEl`) lives in SOURCE-PIXEL space.
 *   - imgPx = (ref - imageOffset) / imageScale  (inverse of toLocal in
 *     runStripDetectionFromLoupe).
 *
 * The template is always the axis-aligned bbox of the annotation contour.
 * POINT / MARKER have no contour, so a fixed source-pixel box around the
 * point is used instead (PATCH_BOX_PX) — coarse but enough to anchor a
 * relative paste.
 *
 * @returns { patternData: ImageData, bboxImgPx: {x,y,width,height} } | null
 */
const PATCH_BOX_PX = 64;

function refToImgPx(p, scale, offset) {
  return { x: (p.x - offset.x) / scale, y: (p.y - offset.y) / scale };
}

export default function extractAnnotationImagePatch({
  clipboard,
  sourceImageEl,
  imageScale,
  imageOffset,
}) {
  if (!clipboard || !sourceImageEl) return null;

  const scale = imageScale || 1;
  const offset = imageOffset || { x: 0, y: 0 };
  const type = clipboard.annotation?.type;

  let bbox; // source-pixel space
  if (type === "POLYGON" || type === "POLYLINE" || type === "STRIP") {
    const pts = clipboard.basePoints;
    if (!pts?.length) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      const ip = refToImgPx(p, scale, offset);
      if (ip.x < minX) minX = ip.x;
      if (ip.y < minY) minY = ip.y;
      if (ip.x > maxX) maxX = ip.x;
      if (ip.y > maxY) maxY = ip.y;
    }
    bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  } else if (type === "POINT" || type === "MARKER") {
    const p = clipboard.basePoint;
    if (!p) return null;
    const ip = refToImgPx(p, scale, offset);
    bbox = {
      x: ip.x - PATCH_BOX_PX / 2,
      y: ip.y - PATCH_BOX_PX / 2,
      width: PATCH_BOX_PX,
      height: PATCH_BOX_PX,
    };
  } else {
    return null;
  }

  const W = sourceImageEl.naturalWidth || sourceImageEl.width;
  const H = sourceImageEl.naturalHeight || sourceImageEl.height;
  if (!W || !H) return null;

  const bx = Math.max(0, Math.floor(bbox.x));
  const by = Math.max(0, Math.floor(bbox.y));
  const bw = Math.min(W - bx, Math.ceil(bbox.width));
  const bh = Math.min(H - by, Math.ceil(bbox.height));
  if (bw < 2 || bh < 2) return null;

  const canvas = document.createElement("canvas");
  canvas.width = bw;
  canvas.height = bh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(sourceImageEl, bx, by, bw, bh, 0, 0, bw, bh);
  const patternData = ctx.getImageData(0, 0, bw, bh);

  return { patternData, bboxImgPx: { x: bx, y: by, width: bw, height: bh } };
}
