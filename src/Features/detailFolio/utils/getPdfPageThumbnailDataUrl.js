const THUMBNAIL_WIDTH = 200;

// Renders one page of an already-loaded pdfjs document to a small jpeg
// dataURL — the folio snapshot stored on the annotation row, so the Folio tab
// can display the page without re-parsing the PDF (and after a Krto import
// where the main file blob is absent).
export default async function getPdfPageThumbnailDataUrl(
  pdfDocument,
  pageNumber,
  rotation = 0,
  bboxInRatio = null
) {
  const page = await pdfDocument.getPage(pageNumber);

  // Absolute rotation, same convention as renderPageToPngBlob.
  const viewportRaw = page.getViewport({ scale: 1, rotation });
  // Optional crop (fractions of the rotated page), same convention as
  // renderPageToPngBlob: the thumbnail then shows the zone only.
  const crop = bboxInRatio
    ? {
        x: bboxInRatio.x1,
        y: bboxInRatio.y1,
        width: bboxInRatio.x2 - bboxInRatio.x1,
        height: bboxInRatio.y2 - bboxInRatio.y1,
      }
    : { x: 0, y: 0, width: 1, height: 1 };
  const scale = THUMBNAIL_WIDTH / (viewportRaw.width * crop.width);
  const viewport = page.getViewport({ scale, rotation });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.max(1, Math.round(viewport.width * crop.width));
  canvas.height = Math.max(1, Math.round(viewport.height * crop.height));
  if (bboxInRatio) {
    context.translate(-crop.x * viewport.width, -crop.y * viewport.height);
  }

  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();

  return canvas.toDataURL("image/jpeg", 0.7);
}
