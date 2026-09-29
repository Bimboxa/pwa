import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";

import getIsDocumentFromPdfStats from "../utils/getIsDocumentFromPdfStats";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

const SAMPLED_PAGES = 3;

// Tells whether a PDF is a text "document" (CCTP, DPGF…) rather than a plan,
// from the text density and page size of its first pages. Pass an already
// loaded `pdfDocument` to skip the parsing. Never throws: false on error.
export default async function detectIsPdfDocumentService({
  file,
  pdfDocument,
}) {
  let loadingTask = null;
  try {
    let pdf = pdfDocument;
    if (!pdf) {
      if (!file) return false;
      const data = await file.arrayBuffer();
      loadingTask = getDocument({ data, ...PDFJS_DOC_PARAMS });
      pdf = await loadingTask.promise;
    }

    const pages = [];
    const count = Math.min(pdf.numPages, SAMPLED_PAGES);
    for (let p = 1; p <= count; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const charCount = content.items.reduce(
        (sum, it) => sum + (it.str?.trim().length ?? 0),
        0
      );
      pages.push({
        charCount,
        widthPt: viewport.width,
        heightPt: viewport.height,
      });
      page.cleanup();
    }

    return getIsDocumentFromPdfStats({ pages });
  } catch (e) {
    console.warn("[resources] isDocument detection failed", e);
    return false;
  } finally {
    if (loadingTask) loadingTask.destroy().catch(() => {});
  }
}
