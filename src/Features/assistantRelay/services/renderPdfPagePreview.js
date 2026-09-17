import { getDocument } from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Light rasterization of a whole PDF page for a preview (NOT the base map
 * pipeline: no crop, no auto-DPI). `rotation` is absolute, like the relay
 * frame (it replaces the page's own /Rotate). Returns an object URL the
 * caller must revoke.
 */
export default async function renderPdfPagePreview({
  pdfBlob,
  pageNumber = 1,
  rotation = 0,
  maxLongEdge = 1400,
}) {
  const data = await pdfBlob.arrayBuffer();
  const pdfDocument = await getDocument({ data, ...PDFJS_DOC_PARAMS }).promise;
  try {
    const page = await pdfDocument.getPage(pageNumber);
    const base = page.getViewport({ scale: 1, rotation });
    const scale = maxLongEdge / Math.max(base.width, base.height);
    const viewport = page.getViewport({ scale, rotation });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8)
    );
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) throw new Error("Aperçu de la page impossible.");
    return URL.createObjectURL(blob);
  } finally {
    pdfDocument.destroy();
  }
}
