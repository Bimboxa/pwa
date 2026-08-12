const THUMBNAIL_WIDTH = 200;

// Renders one page of an already-loaded pdfjs document to a small jpeg
// dataURL — the folio snapshot stored on the annotation row, so the Folio tab
// can display the page without re-parsing the PDF (and after a Krto import
// where the main file blob is absent).
export default async function getPdfPageThumbnailDataUrl(
  pdfDocument,
  pageNumber,
  rotation = 0
) {
  const page = await pdfDocument.getPage(pageNumber);

  // Absolute rotation, same convention as renderPageToPngBlob.
  const viewportRaw = page.getViewport({ scale: 1, rotation });
  const scale = THUMBNAIL_WIDTH / viewportRaw.width;
  const viewport = page.getViewport({ scale, rotation });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();

  return canvas.toDataURL("image/jpeg", 0.7);
}
