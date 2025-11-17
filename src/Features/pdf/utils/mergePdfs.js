import { PDFDocument, StandardFonts } from "pdf-lib";

/**
 * Merges multiple PDF files into a single PDF document
 * @param {Array<Blob|File>} pdfs - Array of PDF files to merge
 * @returns {Promise<Blob>} - Merged PDF as a Blob
 */
export default async function mergePdfs(pdfs, options = {}) {
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

  if (options?.addPageNumber) {
    const pages = mergedPdf.getPages();
    const totalPages = pages.length;
    if (totalPages > 0) {
      const fontName = options.pageNumberFont ?? StandardFonts.Helvetica;
      const font = await mergedPdf.embedFont(fontName);
      const fontSize = options.pageNumberFontSize ?? 10;
      const margin = options.pageNumberMargin ?? 20;

      pages.forEach((page, index) => {
        const { width } = page.getSize();
        const text = `${index + 1} / ${totalPages}`;
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const x = width - textWidth - margin;
        const y = margin;
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
        });
      });
    }
  }

  // Generate the final merged PDF
  const mergedPdfBytes = await mergedPdf.save();
  return new Blob([mergedPdfBytes], { type: "application/pdf" });
}
