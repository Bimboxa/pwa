// Scale applied to a PDF page (pdfjs viewport at scale 1) so it fits its
// scroll container:
// - "width": the page fills the container width (vertical scroll);
// - "page": the whole page is visible at zoom 1 (min of the width and the
//   height fits), `zoom` then magnifies it.
// `padding` is the margin kept on each side of the page.
const MIN_SCALE = 0.1;

export default function getPdfPageFitScale({
  fitMode = "width",
  zoom = 1,
  containerWidth,
  containerHeight,
  pageWidth,
  pageHeight,
  padding = 0,
}) {
  if (!(pageWidth > 0) || !(containerWidth > 0)) return MIN_SCALE;

  let fit = (containerWidth - 2 * padding) / pageWidth;
  if (fitMode === "page" && containerHeight > 0 && pageHeight > 0) {
    fit = Math.min(fit, (containerHeight - 2 * padding) / pageHeight);
  }
  return Math.max(MIN_SCALE, fit * (zoom > 0 ? zoom : 1));
}
