/**
 * Apply the paste transform (flipX → rotation by a multiple of 90°) to an
 * ImageData, returning a new ImageData. Same flip-then-rotate order and
 * angle convention as applyPasteTransformToPoints, so a template
 * transformed here matches the geometry placed by the paste/commit path.
 *
 * Used so pattern detection (cv.matchTemplate is rigid) searches for the
 * motif at the orientation/mirroring the user picked with R / I.
 */
export default function transformImageData(imageData, transform) {
  if (!imageData) return imageData;
  const { rotationDeg = 0, flipX = false } = transform || {};
  const rot = (((rotationDeg % 360) + 360) % 360);
  if (rot === 0 && !flipX) return imageData;

  const w = imageData.width;
  const h = imageData.height;

  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  src.getContext("2d").putImageData(imageData, 0, 0);

  const swap = rot === 90 || rot === 270;
  const dw = swap ? h : w;
  const dh = swap ? w : h;

  const dst = document.createElement("canvas");
  dst.width = dw;
  dst.height = dh;
  const ctx = dst.getContext("2d", { willReadFrequently: true });
  ctx.translate(dw / 2, dh / 2);
  ctx.rotate((rot * Math.PI) / 180);
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(src, -w / 2, -h / 2);

  return ctx.getImageData(0, 0, dw, dh);
}
