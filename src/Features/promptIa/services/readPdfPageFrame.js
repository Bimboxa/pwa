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
/**
 * Geometry of EVERY page of a PDF (attachments of the Prompt IA zip): the
 * model needs the page sizes and rotations to give page-relative zones.
 * `width` / `height` are those of `view`, in points, before /Rotate.
 *
 * @returns {Promise<{pageCount: number, pages: Array<{number: number, width: number, height: number, rotate: number}>}>}
 */
export async function readPdfPageFrames(pdfBlob) {
  const data = await pdfBlob.arrayBuffer();
  const pdfDocument = await getDocument({ data, ...PDFJS_DOC_PARAMS }).promise;
  try {
    const pages = [];
    for (let number = 1; number <= pdfDocument.numPages; number++) {
      const page = await pdfDocument.getPage(number);
      const view = page.view.map((v) => Number(v));
      pages.push({
        number,
        width: Math.round((view[2] - view[0]) * 100) / 100,
        height: Math.round((view[3] - view[1]) * 100) / 100,
        rotate: Number(page.rotate ?? 0),
      });
      page.cleanup();
    }
    return { pageCount: pdfDocument.numPages, pages };
  } finally {
    pdfDocument.destroy();
  }
}

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
