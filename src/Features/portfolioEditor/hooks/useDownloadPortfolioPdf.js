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
  drawPageNumOnPdfPage,
} from "Features/titleBlocks/utils/drawTitleBlockOnPdfPage";
import sanitizeWinAnsiText from "Features/titleBlocks/utils/sanitizeWinAnsiText";
import getPortfolioPageFrameConfig from "Features/portfolios/utils/getPortfolioPageFrameConfig";

import getPageDimensions from "../utils/getPageDimensions";
import getPageLayout, {
  getCartoucheRectBottomRight,
} from "../utils/getPageLayout";
import computePageFrame from "../utils/computePageFrame";
import drawPageFrameOnPdfPage from "../utils/drawPageFrameOnPdfPage";
import getPageAnnotationsWithDetails from "../utils/getPageAnnotationsWithDetails";
import resolveTitleFormat from "../utils/resolveTitleFormat";
import getPortfolioPageTitleText from "../utils/getPortfolioPageTitleText";
import resolveDetailRefFormat, {
  getDetailRefText,
} from "../utils/resolveDetailRefFormat";
import getFolioDetailRef from "../utils/getFolioDetailRef";

function hexToPdfRgb(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!match) return rgb(0.2, 0.2, 0.2);
  const int = parseInt(match[1], 16);
  return rgb(
    ((int >> 16) & 255) / 255,
    ((int >> 8) & 255) / 255,
    (int & 255) / 255
  );
}

// Vector redraw of PortfolioTitleBarSvg / PortfolioDetailRefSvg from the
// page's resolved format: bold single line in the rect (12pt side padding,
// align left/center/right), optional underline.
function drawTitleBarOnPdfPage(
  page,
  { rect, text, font, color, fontSize, underline, align = "left" }
) {
  const t = sanitizeWinAnsiText(text);
  if (!t) return;
  const size = fontSize || 14;
  const pageHeight = page.getSize().height;
  const textWidth = font.widthOfTextAtSize(t, size);
  let x = rect.x + 12;
  if (align === "right") x = rect.x + rect.width - 12 - textWidth;
  else if (align === "center") x = rect.x + (rect.width - textWidth) / 2;
  const y = pageHeight - rect.y - (rect.height + size) / 2;
  const pdfColor = hexToPdfRgb(color);
  page.drawText(t, { x, y, size, font, color: pdfColor });
  if (underline) {
    page.drawLine({
      start: { x, y: y - 3 },
      end: { x: x + textWidth, y: y - 3 },
      thickness: 1,
      color: pdfColor,
    });
  }
}

export default function useDownloadPortfolioPdf() {
  const [loading, setLoading] = useState(false);
  const appConfig = useAppConfig();

  async function download({ portfolio, project, pages, spriteImage, portfolioLogoUrl, hdExport }) {
    if (!pages?.length) return;
    setLoading(true);

    try {
      const manifest = getTitleBlockManifest(appConfig, portfolio);
      const pageFrameConfig = getPortfolioPageFrameConfig(appConfig);
      const metadata = portfolio?.metadata || {};
      const values = resolveTitleBlockFields(manifest, metadata);
      const baseBindings = {
        "project.name": project?.name || "",
        "portfolio.name": portfolio?.name || "",
      };

      const pagePdfs = [];
      // one entry per PDF page:
      // { type: "PLAN"|"SUMMARY"|"FOLIO", layout, pageTitle } — a FOLIO meta
      // without layout means the raw-copy fallback (nothing stamped on it)
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
          // folio.rotation is ABSOLUTE (it replaces the page's intrinsic
          // /Rotate, same convention as renderPageToPngBlob in the app)
          const rotation = ((page.folio?.rotation ?? 0) % 360 + 360) % 360;
          const rot = rotation % 90 === 0 ? rotation : 0;
          let folioDoc;
          let folioMeta = { type: "FOLIO" }; // fallback: page kept, no cartouche
          try {
            // Normalize: embed the source page into a fresh /Rotate-0 page
            // with the rotation baked in, so the cartouche can be drawn in
            // plain page coordinates in the vector pass.
            folioDoc = await PDFDocument.create();
            const srcPage = srcDoc.getPage(pageIndex);
            // explicit CropBox: pdf-lib's default boundingBox is the MediaBox
            // with an assumed (0,0) origin, wrong on cropped/offset pages
            const crop = srcPage.getCropBox();
            const embedded = await folioDoc.embedPage(srcPage, {
              left: crop.x,
              bottom: crop.y,
              right: crop.x + crop.width,
              top: crop.y + crop.height,
            });
            const w = embedded.width;
            const h = embedded.height;
            const swap = rot === 90 || rot === 270;
            const newPage = folioDoc.addPage([swap ? h : w, swap ? w : h]);
            // pdf-lib rotate is CCW-positive, /Rotate is CW-positive
            const draw = {
              0: { x: 0, y: 0 },
              90: { x: 0, y: w, rotate: degrees(-90) },
              180: { x: w, y: h, rotate: degrees(180) },
              270: { x: h, y: 0, rotate: degrees(90) },
            }[rot];
            newPage.drawPage(embedded, draw);
            const folioDims = {
              width: newPage.getWidth(),
              height: newPage.getHeight(),
            };
            // configurable title, in the normalized folio page's own dims
            const titleFormat = resolveTitleFormat(page, {
              titleBar: null,
              pageDims: folioDims,
              pageFrame: pageFrameConfig,
            });
            // detail reference element ("Détail 3"), folio pages only
            const detailRefFormat = resolveDetailRefFormat(page, {
              pageDims: folioDims,
              pageFrame: pageFrameConfig,
            });
            const detailRefText = detailRefFormat.show
              ? getDetailRefText(detailRefFormat, await getFolioDetailRef(page))
              : null;
            folioMeta = {
              type: "FOLIO",
              pageTitle: page.title || "",
              titleFormat,
              titleText: getPortfolioPageTitleText(titleFormat, {
                portfolioName: portfolio?.name,
                pageName: page.title,
              }),
              detailRefFormat,
              detailRefText,
            };
            const cartouche = getCartoucheRectBottomRight(
              folioDims,
              manifest.height,
              pageFrameConfig
            );
            if (cartouche) {
              folioMeta.layout = {
                variant: "BOTTOM_RIGHT",
                cartouche,
                titleBar: null,
              };
            }
          } catch (err) {
            // e.g. MissingPageContentsEmbeddingError on content-less pages
            console.warn(
              "[portfolio pdf] folio embed failed, raw copy fallback",
              err
            );
            folioDoc = await PDFDocument.create();
            const [copiedPage] = await folioDoc.copyPages(srcDoc, [pageIndex]);
            if (rot) copiedPage.setRotation(degrees(rot));
            folioDoc.addPage(copiedPage);
            folioMeta = { type: "FOLIO" };
          }
          const folioBytes = await folioDoc.save();
          pagePdfs.push(new Blob([folioBytes], { type: "application/pdf" }));
          pageMetas.push(folioMeta);
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
          manifest.height,
          pageFrameConfig
        );

        // hide the title block + title bar + page frame before SVG capture:
        // they are redrawn as vector content on the pdf-lib page after merge
        const hiddenEls = [
          svgEl.querySelector("[data-portfolio-header]"),
          svgEl.querySelector("[data-portfolio-title-bar]"),
          svgEl.querySelector("[data-portfolio-frame]"),
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
        const titleFormat = resolveTitleFormat(page, {
          titleBar: layout.titleBar,
          pageDims: dims,
          pageFrame: pageFrameConfig,
        });
        pageMetas.push({
          type: "PLAN",
          layout,
          pageTitle: page.title || "",
          titleFormat,
          titleText: getPortfolioPageTitleText(titleFormat, {
            portfolioName: portfolio?.name,
            pageName: page.title,
          }),
        });

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
              headerMargin: pageFrameConfig?.innerInset,
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
            manifest.height,
            pageFrameConfig
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
        if (!meta) return;

        const pageNum = `p. ${index + 1} / ${allPages.length}`;

        // double page border frame, on every page except folios (their
        // source PDFs already carry their own frame)
        if (meta.type !== "FOLIO") {
          drawPageFrameOnPdfPage(
            pdfPage,
            computePageFrame(pdfPage.getSize(), pageFrameConfig)
          );
        }

        if (meta.type === "PLAN" || meta.type === "FOLIO") {
          if (meta.titleFormat?.show && meta.titleText) {
            drawTitleBarOnPdfPage(pdfPage, {
              rect: meta.titleFormat.rect,
              text: meta.titleText,
              font: fonts.bold,
              color: meta.titleFormat.color,
              fontSize: meta.titleFormat.fontSize,
              underline: meta.titleFormat.underline,
            });
          }
          if (meta.detailRefFormat?.show && meta.detailRefText) {
            drawTitleBarOnPdfPage(pdfPage, {
              rect: meta.detailRefFormat.rect,
              text: meta.detailRefText,
              font: fonts.bold,
              color: meta.detailRefFormat.color,
              fontSize: meta.detailRefFormat.fontSize,
              underline: false,
              align: meta.detailRefFormat.align,
            });
          }
          if (!meta.layout) return; // FOLIO fallback: no cartouche
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
          return;
        }

        // SUMMARY: only stamp the global page number in the title block cell
        // (the cartouche itself was drawn with skipPageNum at generation)
        const layoutData = computeTitleBlockLayout(
          manifest,
          meta.layout.cartouche,
          { variant: meta.layout.variant }
        );
        drawPageNumOnPdfPage(pdfPage, {
          layoutData,
          style: manifest.style,
          fonts,
          text: pageNum,
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
