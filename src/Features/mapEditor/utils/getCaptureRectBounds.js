// Centered rectangle inside a viewport, matching one of three aspect ratios.
// Returns the rect bounds in pixels (viewport-local coords).

// A4 paper: 210mm × 297mm. We match its aspect ratio for landscape and
// portrait so the captured PNG drops cleanly into Word/PDF page layouts.
const ASPECT_RATIOS = {
  LANDSCAPE: 297 / 210, // ≈ 1.4143
  SQUARE: 1,
  PORTRAIT: 210 / 297, // ≈ 0.7071
};

export default function getCaptureRectBounds(
  viewportWidth,
  viewportHeight,
  aspectRatio = "LANDSCAPE",
  { margin = 40, rightInset = 0 } = {}
) {
  if (!viewportWidth || !viewportHeight) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }

  // `rightInset` is the width occluded on the right by an open panel that
  // floats over the viewport (it doesn't shrink the measured host). We
  // center the rect within the *visible* zone (viewportWidth - rightInset)
  // so it never sits under the panel.
  const availWidth = Math.max(0, viewportWidth - rightInset);

  const ratio = ASPECT_RATIOS[aspectRatio] ?? ASPECT_RATIOS.LANDSCAPE;
  const maxW = Math.max(0, availWidth - margin * 2);
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

  const left = (availWidth - width) / 2;
  const top = (viewportHeight - height) / 2;
  return { left, top, width, height };
}

export { ASPECT_RATIOS };
