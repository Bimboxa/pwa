import { useState } from "react";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";
import imageToPdfAsync from "Features/pdf/utils/imageToPdfAsync";
import mergePdfs from "Features/pdf/utils/mergePdfs";
import downloadBlob from "Features/files/utils/downloadBlob";
import createAnnotationsPdfReport from "Features/pdfReport/utils/createAnnotationsPdfReport";

import getPageDimensions from "../utils/getPageDimensions";
import getPageLayout from "../utils/getPageLayout";
import getPageAnnotationsWithDetails from "../utils/getPageAnnotationsWithDetails";

import { ROW_HEIGHT, LOGO_COL_WIDTH } from "../utils/computeHeaderPosition";

const PAGE_NUM_WIDTH = 50;

function getPageNumPosition(layout, pageHeight) {
  const rect = layout.cartouche;
  const isNarrow = layout.variant === "BOTTOM_RIGHT";
  const logoW = isNarrow
    ? Math.min(LOGO_COL_WIDTH, Math.round(rect.width * 0.2))
    : LOGO_COL_WIDTH;
  const contentW = rect.width - logoW;
  const labelW = isNarrow ? 55 : Math.max(55, Math.round(contentW * 0.08));
  const metaLabelW = isNarrow ? 65 : Math.max(65, Math.round(contentW * 0.11));
  const metaValueW = isNarrow ? 80 : Math.max(80, Math.round(contentW * 0.15));
  const mainW = contentW - labelW - metaLabelW - metaValueW;

  const xPageNum = rect.x + logoW + labelW + mainW - PAGE_NUM_WIDTH;
  // Row 3 in SVG: y = cartouche.y + 2 * ROW_HEIGHT
  // In PDF coords (bottom-left origin): y = pageHeight - svgY - ROW_HEIGHT
  const svgY = rect.y + 2 * ROW_HEIGHT;
  const pdfY = pageHeight - svgY - ROW_HEIGHT;

  return { x: xPageNum, y: pdfY, width: PAGE_NUM_WIDTH, height: ROW_HEIGHT };
}

export default function useDownloadPortfolioPdf() {
  const [loading, setLoading] = useState(false);

  async function download({ portfolio, project, pages, spriteImage, portfolioLogoUrl, hdExport }) {
    if (!pages?.length) return;
    setLoading(true);

    try {
      const pagePdfs = [];
      const pageLayouts = []; // layout per PDF page (for page number positioning)

      for (const page of pages) {
        const svgEl = document.querySelector(
          `svg[data-portfolio-page-id="${page.id}"]`
        );
        if (!svgEl) continue;

        const dims = getPageDimensions(page.format, page.orientation);
        const layout = getPageLayout(page.format, page.orientation);

        // hide page number in cartouche before SVG capture
        const pageNumEl = svgEl.querySelector("[data-page-number]");
        if (pageNumEl) pageNumEl.style.visibility = "hidden";

        // capture SVG as PNG blob
        // Always render at 2x for non-retina screens; HD doubles again to 4x
        const pixelRatio = hdExport ? 4 : 2;
        const blob = await getImageFromSvg(svgEl, { pixelRatio });

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
        pageLayouts.push(layout);

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
          // Summary pages use A4 portrait layout (TOP_FULL)
          const summaryLayout = getPageLayout("A4", "portrait");
          // A summary PDF may contain multiple pages
          const summaryBytes = await summaryPdf.arrayBuffer();
          const summaryDoc = await PDFDocument.load(summaryBytes);
          const summaryPageCount = summaryDoc.getPageCount();
          for (let i = 0; i < summaryPageCount; i++) {
            pageLayouts.push(summaryLayout);
          }
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

      allPages.forEach((pdfPage, index) => {
        const { height } = pdfPage.getSize();
        const pageLayout = pageLayouts[index];
        if (!pageLayout) return;
        const pos = getPageNumPosition(pageLayout, height);
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
