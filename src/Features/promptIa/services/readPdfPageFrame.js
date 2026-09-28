import { getDocument } from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Geometry of one PDF page as pdf.js sees it: `view` = [x0, y0, x1, y1] of
 * CropBox ∩ MediaBox in user space (points, y up) and the page's intrinsic
 * /Rotate. This is what the relay calls `SourcePdfPage` and what the
 * pdf_user_space → image conversion needs (see pdfUserSpaceToImage.js).
 *
 * @returns {Promise<{view: number[], rotate: number, width: number, height: number, pageCount: number}>}
 */
export default async function readPdfPageFrame(pdfBlob, pageNumber = 1) {
  const data = await pdfBlob.arrayBuffer();
  const pdfDocument = await getDocument({ data, ...PDFJS_DOC_PARAMS }).promise;
  try {
    const page = await pdfDocument.getPage(pageNumber);
    const view = page.view.map((v) => Number(v));
    return {
      view,
      rotate: Number(page.rotate ?? 0),
      width: view[2] - view[0],
      height: view[3] - view[1],
      pageCount: pdfDocument.numPages,
    };
  } finally {
    pdfDocument.destroy();
  }
}
