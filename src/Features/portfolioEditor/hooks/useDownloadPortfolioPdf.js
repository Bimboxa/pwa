import { useState } from "react";

import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";
import imageToPdfAsync from "Features/pdf/utils/imageToPdfAsync";
import mergePdfs from "Features/pdf/utils/mergePdfs";
import downloadBlob from "Features/files/utils/downloadBlob";
import createAnnotationsPdfReport from "Features/pdfReport/utils/createAnnotationsPdfReport";

import getTitleBlockManifest from "Features/titleBlocks/utils/getTitleBlockManifest";
import resolveTitleBlockFields from "Features/titleBlocks/utils/resolveTitleBlockFields";
import computeTitleBlockLayout from "Features/titleBlocks/utils/computeTitleBlockLayout";
import drawTitleBlockOnPdfPage, {
  embedTitleBlockLogo,
} from "Features/titleBlocks/utils/drawTitleBlockOnPdfPage";
import sanitizeWinAnsiText from "Features/titleBlocks/utils/sanitizeWinAnsiText";

import getPageDimensions from "../utils/getPageDimensions";
import getPageLayout from "../utils/getPageLayout";
import getPageAnnotationsWithDetails from "../utils/getPageAnnotationsWithDetails";

const TITLE_BAR_FONT_SIZE = 14;

// Vector redraw of PortfolioTitleBarSvg (A3 landscape BOTTOM_RIGHT variant):
// bold underlined "portfolio · page" line, left-aligned in the title bar.
function drawTitleBarOnPdfPage(page, { titleBar, text, font }) {
  const t = sanitizeWinAnsiText(text);
  if (!t) return;
  const pageHeight = page.getSize().height;
  const x = titleBar.x + 12;
  const y =
    pageHeight - titleBar.y - (titleBar.height + TITLE_BAR_FONT_SIZE) / 2;
  const color = rgb(0.2, 0.2, 0.2);
  page.drawText(t, { x, y, size: TITLE_BAR_FONT_SIZE, font, color });
  const textWidth = font.widthOfTextAtSize(t, TITLE_BAR_FONT_SIZE);
  page.drawLine({
    start: { x, y: y - 3 },
    end: { x: x + textWidth, y: y - 3 },
    thickness: 1,
    color,
  });
}

export default function useDownloadPortfolioPdf() {
  const [loading, setLoading] = useState(false);
  const appConfig = useAppConfig();

  async function download({ portfolio, project, pages, spriteImage, portfolioLogoUrl, hdExport }) {
    if (!pages?.length) return;
    setLoading(true);

    try {
      const manifest = getTitleBlockManifest(appConfig, portfolio);
      const metadata = portfolio?.metadata || {};
      const values = resolveTitleBlockFields(manifest, metadata);
      const baseBindings = {
        "project.name": project?.name || "",
        "portfolio.name": portfolio?.name || "",
      };

      const pagePdfs = [];
      // one entry per PDF page: { type: "PLAN"|"SUMMARY", layout, pageTitle }
      // or { type: "FOLIO" } (nothing stamped on folio pages, for now)
      const pageMetas = [];

      // source PDFs of folio pages, parsed once per resource
      const sourceDocsCache = new Map(); // resourceId -> PDFDocument | null
      async function loadSourceDoc(resourceId) {
        if (!resourceId) return null;
        if (sourceDocsCache.has(resourceId))
          return sourceDocsCache.get(resourceId);
        let doc = null;
        try {
          const resource = await db.resources.get(resourceId);
          const fileRecord = resource?.fileName
            ? await db.files.get(resource.fileName)
            : null;
          if (fileRecord?.fileArrayBuffer) {
            doc = await PDFDocument.load(fileRecord.fileArrayBuffer);
          }
        } catch (err) {
          console.error("[portfolio pdf] failed to load source PDF", err);
        }
        sourceDocsCache.set(resourceId, doc);
        return doc;
      }

      for (const page of pages) {
        // folio pages embed the original PDF page (vector copy), no DOM capture
        if (page.type === "FOLIO_PAGE") {
          const srcDoc = await loadSourceDoc(page.folio?.resourceId);
          if (!srcDoc) {
            console.warn(
              `[portfolio pdf] folio page "${page.title}": source PDF missing, page skipped`
            );
            continue;
          }
          const pageIndex = Math.min(
            Math.max((page.folio?.pageNumber ?? 1) - 1, 0),
            srcDoc.getPageCount() - 1
          );
          const folioDoc = await PDFDocument.create();
          const [copiedPage] = await folioDoc.copyPages(srcDoc, [pageIndex]);
          // folio.rotation is ABSOLUTE (it replaces the page's intrinsic
          // /Rotate, same convention as renderPageToPngBlob in the app)
          const rotation = ((page.folio?.rotation ?? 0) % 360 + 360) % 360;
          if (rotation % 90 === 0) copiedPage.setRotation(degrees(rotation));
          folioDoc.addPage(copiedPage);
          const folioBytes = await folioDoc.save();
          pagePdfs.push(new Blob([folioBytes], { type: "application/pdf" }));
          pageMetas.push({ type: "FOLIO" });
          continue;
        }

        const svgEl = document.querySelector(
          `svg[data-portfolio-page-id="${page.id}"]`
        );
        if (!svgEl) continue;

        const dims = getPageDimensions(page.format, page.orientation);
        const layout = getPageLayout(
          page.format,
          page.orientation,
          0,
          manifest.height
        );

        // hide the title block + title bar before SVG capture: they are
        // redrawn as vector content on the pdf-lib page after merge
        const hiddenEls = [
          svgEl.querySelector("[data-portfolio-header]"),
          svgEl.querySelector("[data-portfolio-title-bar]"),
        ].filter(Boolean);
        hiddenEls.forEach((el) => (el.style.visibility = "hidden"));

        // capture SVG as PNG blob
        // Always render at 2x for non-retina screens; HD doubles again to 4x
        const pixelRatio = hdExport ? 4 : 2;
        const blob = await getImageFromSvg(svgEl, { pixelRatio });

        hiddenEls.forEach((el) => (el.style.visibility = ""));

        const url = URL.createObjectURL(blob);

        // create single-page PDF with correct page size
        const pdf = await imageToPdfAsync({
          url,
          pageWidth: dims.width,
          pageHeight: dims.height,
        });

        URL.revokeObjectURL(url);
        pagePdfs.push(pdf);
        pageMetas.push({ type: "PLAN", layout, pageTitle: page.title || "" });

        // generate annotation summary pages for this plan page
        const annotationsWithDetails = await getPageAnnotationsWithDetails(
          page.id
        );
        if (annotationsWithDetails.length > 0) {
          const summaryPdf = await createAnnotationsPdfReport(
            annotationsWithDetails,
            {
              spriteImage,
              logoImage: portfolioLogoUrl
                ? { url: portfolioLogoUrl }
                : undefined,
              title: page.title || "Annotations",
              titleBlock: {
                manifest,
                values,
                labelOverrides: metadata,
                bindings: {
                  ...baseBindings,
                  "page.title": page.title || "",
                },
              },
            }
          );
          pagePdfs.push(summaryPdf);
          // Summary pages use A4 portrait layout (TOP_FULL)
          const summaryLayout = getPageLayout(
            "A4",
            "portrait",
            0,
            manifest.height
          );
          // A summary PDF may contain multiple pages
          const summaryBytes = await summaryPdf.arrayBuffer();
          const summaryDoc = await PDFDocument.load(summaryBytes);
          const summaryPageCount = summaryDoc.getPageCount();
          for (let i = 0; i < summaryPageCount; i++) {
            pageMetas.push({ type: "SUMMARY", layout: summaryLayout });
          }
        }
      }

      if (pagePdfs.length === 0) return;

      // merge all pages WITHOUT footer page numbers
      const merged = await mergePdfs(pagePdfs, { addPageNumber: false });

      // vector pass: draw the title block on plan pages, stamp the global
      // page number on summary pages (their title block is already drawn)
      const mergedBytes = await merged.arrayBuffer();
      const pdfDoc = await PDFDocument.load(mergedBytes);
      const fonts = {
        regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
        bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
      };
      const logoImage = await embedTitleBlockLogo(
        pdfDoc,
        portfolioLogoUrl ||
          (typeof metadata.logo === "string" ? metadata.logo : null)
      );
      const allPages = pdfDoc.getPages();

      allPages.forEach((pdfPage, index) => {
        const meta = pageMetas[index];
        if (!meta || meta.type === "FOLIO") return;

        const pageNum = `p. ${index + 1}`;

        if (meta.type === "PLAN") {
          const layoutData = computeTitleBlockLayout(
            manifest,
            meta.layout.cartouche,
            {
              variant: meta.layout.variant,
              values,
              bindings: {
                ...baseBindings,
                "page.title": meta.pageTitle,
                pageNum,
              },
              labelOverrides: metadata,
            }
          );
          drawTitleBlockOnPdfPage(pdfPage, {
            layoutData,
            style: manifest.style,
            fonts,
            logoImage,
          });
          if (meta.layout.titleBar) {
            const text = [portfolio?.name, meta.pageTitle]
              .filter(Boolean)
              .join(" · ");
            drawTitleBarOnPdfPage(pdfPage, {
              titleBar: meta.layout.titleBar,
              text,
              font: fonts.bold,
            });
          }
          return;
        }

        // SUMMARY: only stamp the global page number in the title block cell
        const { pageNumCell } = computeTitleBlockLayout(
          manifest,
          meta.layout.cartouche,
          { variant: meta.layout.variant }
        );
        if (!pageNumCell) return;
        const { height } = pdfPage.getSize();
        const fontSize = manifest.style?.valueFontSize ?? 10;
        const textWidth = fonts.bold.widthOfTextAtSize(pageNum, fontSize);
        pdfPage.drawText(pageNum, {
          x: pageNumCell.x + (pageNumCell.width - textWidth) / 2,
          y:
            height -
            pageNumCell.y -
            (pageNumCell.height + fontSize) / 2,
          size: fontSize,
          font: fonts.bold,
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
