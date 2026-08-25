import { getDocument } from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

import db from "App/db/db";

import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";
import getPdfPageThumbnailDataUrl from "./getPdfPageThumbnailDataUrl";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Builds a folio object ({type: "PDF_PAGE", resourceId, pageNumber, rotation,
// thumbnail}) outside any React context — used by the PDF-page drop on the 2D
// editor, where no pdfjs document is at hand. Loads the resource main file
// from db.files just to render the page snapshot; a missing file yields a
// folio without thumbnail (still resolvable while the file is local).
export default async function buildFolioFromResourcePageAsync({
  resourceId,
  pageNumber,
  rotation = 0,
}) {
  const folio = {
    type: "PDF_PAGE",
    resourceId,
    pageNumber,
    rotation,
    thumbnail: null,
  };

  try {
    const resource = await db.resources.get(resourceId);
    const fileRecord = resource?.fileName
      ? await db.files.get(resource.fileName)
      : null;
    if (!fileRecord?.fileArrayBuffer) return folio;

    // pdfjs transfers the buffer to its worker (detaching it): pass a copy.
    const loadingTask = getDocument({
      data: fileRecord.fileArrayBuffer.slice(0),
      ...PDFJS_DOC_PARAMS,
    });
    const pdfDocument = await loadingTask.promise;
    try {
      folio.thumbnail = await getPdfPageThumbnailDataUrl(
        pdfDocument,
        pageNumber,
        rotation
      );
    } finally {
      pdfDocument.destroy();
    }
  } catch (e) {
    console.error("[detailFolio] buildFolioFromResourcePageAsync error", e);
  }

  return folio;
}
