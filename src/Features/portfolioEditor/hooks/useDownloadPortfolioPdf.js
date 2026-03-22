import { useState } from "react";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";
import imageToPdfAsync from "Features/pdf/utils/imageToPdfAsync";
import mergePdfs from "Features/pdf/utils/mergePdfs";
import downloadBlob from "Features/files/utils/downloadBlob";
import createAnnotationsPdfReport from "Features/pdfReport/utils/createAnnotationsPdfReport";

import getPageDimensions from "../utils/getPageDimensions";
import getPageAnnotationsWithDetails from "../utils/getPageAnnotationsWithDetails";

// Cartouche layout constants (must match computeHeaderPosition + PortfolioHeaderSvg)
const HEADER_MARGIN = 16;
const ROW_HEIGHT = 28;
const PAGE_NUM_WIDTH = 50;
const LOGO_COL_WIDTH = 126;

function getPageNumPosition(pageWidth, pageHeight) {
  const headerWidth = pageWidth - 2 * HEADER_MARGIN;
  const contentW = headerWidth - LOGO_COL_WIDTH;
  const labelW = Math.round(contentW * 0.08);
  const metaLabelW = Math.round(contentW * 0.11);
  const metaValueW = Math.round(contentW * 0.15);
  const mainW = contentW - labelW - metaLabelW - metaValueW;

  const xPageNum = HEADER_MARGIN + LOGO_COL_WIDTH + labelW + mainW - PAGE_NUM_WIDTH;
  // Row 3 in SVG: y = HEADER_MARGIN + 2 * ROW_HEIGHT (from top)
  // In PDF coords (bottom-left origin): y = pageHeight - svgY - ROW_HEIGHT
  const svgY = HEADER_MARGIN + 2 * ROW_HEIGHT;
  const pdfY = pageHeight - svgY - ROW_HEIGHT;

  return { x: xPageNum, y: pdfY, width: PAGE_NUM_WIDTH, height: ROW_HEIGHT };
}

export default function useDownloadPortfolioPdf() {
  const [loading, setLoading] = useState(false);

  async function download({ portfolio, project, pages, spriteImage, portfolioLogoUrl }) {
    if (!pages?.length) return;
    setLoading(true);

    try {
      const pagePdfs = [];

      for (const page of pages) {
        const svgEl = document.querySelector(
          `svg[data-portfolio-page-id="${page.id}"]`
        );
        if (!svgEl) continue;

        const dims = getPageDimensions(page.format, page.orientation);

        // hide page number in cartouche before SVG capture
        const pageNumEl = svgEl.querySelector("[data-page-number]");
        if (pageNumEl) pageNumEl.style.visibility = "hidden";

        // capture SVG as PNG blob
        const blob = await getImageFromSvg(svgEl);

        // restore page number visibility
        if (pageNumEl) pageNumEl.style.visibility = "";

        const url = URL.createObjectURL(blob);

        // create single-page PDF with correct page size
        const pdf = await imageToPdfAsync({
          url,
          pageWidth: dims.width,
          pageHeight: dims.height,
        });

        URL.revokeObjectURL(url);
        pagePdfs.push(pdf);

        // generate annotation summary pages for this plan page
        const annotationsWithDetails = await getPageAnnotationsWithDetails(
          page.id
        );
        if (annotationsWithDetails.length > 0) {
          const config = portfolio?.metadata || {};
          const summaryPdf = await createAnnotationsPdfReport(
            annotationsWithDetails,
            {
              spriteImage,
              logoImage: portfolioLogoUrl
                ? { url: portfolioLogoUrl }
                : undefined,
              title: page.title || "Annotations",
              cartouche: {
                projectName: project?.name || "",
                portfolioName: portfolio?.name || "",
                pageTitle: page.title || "",
                author: config.author || "",
                date: config.date || "",
                refInterne: config.refInterne || "",
                labels: {
                  labelChantier: config.labelChantier,
                  labelPortfolio: config.labelPortfolio,
                  labelPage: config.labelPage,
                  labelRefInterne: config.labelRefInterne,
                  labelAuteur: config.labelAuteur,
                  labelDate: config.labelDate,
                },
              },
            }
          );
          pagePdfs.push(summaryPdf);
        }
      }

      if (pagePdfs.length === 0) return;

      // merge all pages WITHOUT footer page numbers
      const merged = await mergePdfs(pagePdfs, { addPageNumber: false });

      // add global page numbers in the cartouche area
      const mergedBytes = await merged.arrayBuffer();
      const pdfDoc = await PDFDocument.load(mergedBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const allPages = pdfDoc.getPages();
      const totalPages = allPages.length;

      allPages.forEach((pdfPage, index) => {
        const { width, height } = pdfPage.getSize();
        const pos = getPageNumPosition(width, height);
        const text = `p. ${index + 1}`;
        const fontSize = 10;
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        // center text in the page number cell
        const x = pos.x + (pos.width - textWidth) / 2;
        const y = pos.y + (pos.height - fontSize) / 2;
        pdfPage.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
      });

      const finalBytes = await pdfDoc.save();
      const finalBlob = new Blob([finalBytes], { type: "application/pdf" });

      const filename = `${portfolio?.name || "portfolio"}.pdf`;
      downloadBlob(finalBlob, filename);
    } finally {
      setLoading(false);
    }
  }

  return { download, loading };
}
