// Centered rectangle inside a viewport, matching one of three aspect ratios.
// Returns the rect bounds in pixels (viewport-local coords).

const ASPECT_RATIOS = {
  LANDSCAPE: 16 / 9,
  SQUARE: 1,
  PORTRAIT: 9 / 16,
};

export default function getCaptureRectBounds(
  viewportWidth,
  viewportHeight,
  aspectRatio = "LANDSCAPE",
  { margin = 40 } = {}
) {
  if (!viewportWidth || !viewportHeight) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }

  const ratio = ASPECT_RATIOS[aspectRatio] ?? ASPECT_RATIOS.LANDSCAPE;
  const maxW = Math.max(0, viewportWidth - margin * 2);
  const maxH = Math.max(0, viewportHeight - margin * 2);

  let width;
  let height;
  if (maxH > 0 && maxW / maxH > ratio) {
    // viewport is wider than the target ratio → limit by height
    height = maxH;
    width = height * ratio;
  } else {
    width = maxW;
    height = ratio > 0 ? width / ratio : maxH;
  }

  const left = (viewportWidth - width) / 2;
  const top = (viewportHeight - height) / 2;
  return { left, top, width, height };
}

export { ASPECT_RATIOS };
