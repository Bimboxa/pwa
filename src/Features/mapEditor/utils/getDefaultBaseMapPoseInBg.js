import getImageSizeAsync from "Features/images/utils/getImageSizeAsync";

/**
 * Center the base map inside a BG bbox (px) while preserving aspect ratio.
 * - bbox: [x1, y1, x2, y2] in BG-local pixels.
 * - If bbox is not provided, use the full BG image rect.
 * Returns { x, y, k } in BG-local coordinates.
 */
export default function getDefaultBaseMapPoseInBg({
  baseMap,
  bgImage,
}) {

  const { bbox, imageSize: bgSize } = bgImage || {};
  const baseMapSize = baseMap.getImageSize();

  const bmW = Math.max(1, Number(baseMapSize?.width) || 1);
  const bmH = Math.max(1, Number(baseMapSize?.height) || 1);

  // Use provided bbox or default to full BG size
  let [x1, y1, x2, y2] = bbox ?? [0, 0, bgSize.width, bgSize.height];

  // Basic guards/normalization
  if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) {
    [x1, y1, x2, y2] = [0, 0, bgSize.width, bgSize.height];
  }
  if (x2 < x1) [x1, x2] = [x2, x1];
  if (y2 < y1) [y1, y2] = [y2, y1];

  const boxW = Math.max(1, x2 - x1);
  const boxH = Math.max(1, y2 - y1);

  // Fit and center
  const k = Math.min(boxW / bmW, boxH / bmH);
  const x = x1 + (boxW - bmW * k) / 2;
  const y = y1 + (boxH - bmH * k) / 2;

  return { x, y, k };
}
