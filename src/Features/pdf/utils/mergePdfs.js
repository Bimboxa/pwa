import { PDFDocument } from "pdf-lib";

/**
 * Merges multiple PDF files into a single PDF document
 * @param {Array<Blob|File>} pdfs - Array of PDF files to merge
 * @returns {Promise<Blob>} - Merged PDF as a Blob
 */
export default async function mergePdfs(pdfs) {
  if (!pdfs || pdfs.length === 0) {
    throw new Error("No PDFs provided for merging");
  }

  if (pdfs.length === 1) {
    // If only one PDF, return it as-is
    return pdfs[0];
  }

  // Create a new PDF document for merging
  const mergedPdf = await PDFDocument.create();

  // Process each PDF
  for (const pdf of pdfs) {
    // Convert to array buffer
    const pdfBytes = await pdf.arrayBuffer();

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Copy all pages from this PDF
    const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());

    // Add all pages to the merged PDF
    pages.forEach((page) => mergedPdf.addPage(page));
  }

  // Generate the final merged PDF
  const mergedPdfBytes = await mergedPdf.save();
  return new Blob([mergedPdfBytes], { type: "application/pdf" });
}
