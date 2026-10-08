import { PDFDocument } from "pdf-lib";

/**
 * Single-page PDF holding page `pageNumber` (1-based) of `pdf`, boxes and
 * /Rotate preserved (pdf-lib copies the page dictionary as-is).
 *
 * @param {Blob|File} pdf
 * @param {number} pageNumber
 * @returns {Promise<Blob>}
 */
export default async function extractPdfPage(pdf, pageNumber) {
  const sourceDoc = await PDFDocument.load(await pdf.arrayBuffer());
  const index = pageNumber - 1;
  if (!(index >= 0 && index < sourceDoc.getPageCount()))
    throw new Error(`Page ${pageNumber} absente du PDF.`);
  const outDoc = await PDFDocument.create();
  const [page] = await outDoc.copyPages(sourceDoc, [index]);
  outDoc.addPage(page);
  const bytes = await outDoc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
