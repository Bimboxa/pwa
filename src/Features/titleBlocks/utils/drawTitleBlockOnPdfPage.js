import { rgb } from "pdf-lib";

import sanitizeWinAnsiText from "./sanitizeWinAnsiText";
import {
  PAD_VALUE_LEFT,
  PAD_VALUE_RIGHT,
  PAD_LABEL_RIGHT,
} from "./computeTitleBlockLayout";

// pdf-lib drawer for a resolved title block layout (computeTitleBlockLayout
// output, SVG coordinates). All content is drawn as VECTOR primitives
// (drawRectangle / drawLine / drawText / drawSvgPath) except the logo, which
// stays a raster image (pdf-lib cannot embed SVG images).
// Coordinate flip convention: pdfY = pageHeight - svgY - height.

export function hexToRgb01(hex) {
  const m = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex || "");
  const m6 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (m6) {
    return rgb(
      parseInt(m6[1], 16) / 255,
      parseInt(m6[2], 16) / 255,
      parseInt(m6[3], 16) / 255
    );
  }
  if (m) {
    return rgb(
      parseInt(m[1] + m[1], 16) / 255,
      parseInt(m[2] + m[2], 16) / 255,
      parseInt(m[3] + m[3], 16) / 255
    );
  }
  return rgb(0, 0, 0);
}

function truncateToWidth(text, font, size, maxWidth) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ellipsis = "…"; // WinAnsi 0x85, encodable by pdf-lib standard fonts
  let t = text;
  while (
    t.length > 0 &&
    font.widthOfTextAtSize(t + ellipsis, size) > maxWidth
  ) {
    t = t.slice(0, -1);
  }
  return t + ellipsis;
}

// Draws one text primitive (computeTitleBlockLayout `texts` entry), vertically
// centered in its band. Shared by the main drawer and drawPageNumOnPdfPage.
function drawTextPrimitive(
  page,
  pageHeight,
  t,
  { fonts, labelColor, valueColor }
) {
  const cellTopPdfY = pageHeight - t.y;
  const y = cellTopPdfY - (t.height + t.fontSize) / 2;

  // mixed-weight spans (e.g. the logo column footer), left-aligned
  if (t.spans) {
    let x = t.x + PAD_VALUE_LEFT;
    for (const span of t.spans) {
      const font = span.bold ? fonts.bold : fonts.regular;
      const text = sanitizeWinAnsiText(span.text);
      if (!text) continue;
      page.drawText(text, {
        x,
        y,
        size: t.fontSize,
        font,
        color: span.bold ? valueColor : labelColor,
      });
      x += font.widthOfTextAtSize(text, t.fontSize);
    }
    return;
  }

  if (!t.text) return;
  const font = t.bold ? fonts.bold : fonts.regular;
  const color = t.kind === "label" ? labelColor : valueColor;
  const padStart = t.align === "left" ? PAD_VALUE_LEFT : 0;
  const padEnd = t.align === "right" ? PAD_LABEL_RIGHT : PAD_VALUE_RIGHT;
  const maxWidth = Math.max(0, t.width - padStart - padEnd);
  const text = truncateToWidth(
    sanitizeWinAnsiText(t.text),
    font,
    t.fontSize,
    maxWidth
  );
  if (!text) return;
  const textWidth = font.widthOfTextAtSize(text, t.fontSize);
  let x = t.x + padStart;
  if (t.align === "right") x = t.x + t.width - padEnd - textWidth;
  else if (t.align === "center") x = t.x + (t.width - textWidth) / 2;
  page.drawText(text, { x, y, size: t.fontSize, font, color });
}

/**
 * @param page pdf-lib PDFPage
 * @param layoutData computeTitleBlockLayout output
 * @param style manifest.style
 * @param fonts { regular, bold } embedded pdf-lib fonts
 * @param logoImage embedded pdf-lib image or null (see embedTitleBlockLogo)
 * @param skipPageNum leave the page number cell empty (stamped after merge)
 */
export default function drawTitleBlockOnPdfPage(
  page,
  { layoutData, style = {}, fonts, logoImage, skipPageNum = false }
) {
  const pageHeight = page.getSize().height;
  const { frame, lines, texts, imageSlots, svgPaths } = layoutData;

  const borderColor = hexToRgb01(style.borderColor ?? "#333");
  const labelColor = hexToRgb01(style.labelColor ?? "#888");
  const valueColor = hexToRgb01(style.valueColor ?? "#333");

  // frame
  page.drawRectangle({
    x: frame.x,
    y: pageHeight - frame.y - frame.height,
    width: frame.width,
    height: frame.height,
    borderColor,
    borderWidth: style.borderWidth ?? 1,
    color: rgb(1, 1, 1),
  });

  // grid lines
  for (const line of lines) {
    page.drawLine({
      start: { x: line.x1, y: pageHeight - line.y1 },
      end: { x: line.x2, y: pageHeight - line.y2 },
      thickness: style.gridWidth ?? 0.5,
      color: borderColor,
    });
  }

  // texts
  for (const t of texts) {
    if (skipPageNum && t.isPageNum) continue;
    drawTextPrimitive(page, pageHeight, t, { fonts, labelColor, valueColor });
  }

  // decorations (drawSvgPath: path data is y-down relative to the given x/y)
  for (const p of svgPaths) {
    page.drawSvgPath(p.d, {
      x: p.x,
      y: pageHeight - p.y,
      scale: p.scale,
      ...(p.fill ? { color: hexToRgb01(p.fill) } : { color: undefined }),
      ...(p.stroke
        ? { borderColor: hexToRgb01(p.stroke), borderWidth: p.strokeWidth }
        : {}),
    });
  }

  // logo, aspect-fit centered in its slot
  if (logoImage && imageSlots.length > 0) {
    const slot = imageSlots[0];
    const ratio = Math.min(
      slot.width / logoImage.width,
      slot.height / logoImage.height
    );
    const drawW = logoImage.width * ratio;
    const drawH = logoImage.height * ratio;
    page.drawImage(logoImage, {
      x: slot.x + (slot.width - drawW) / 2,
      y: pageHeight - slot.y - slot.height + (slot.height - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }
}

// Stamps the page number into its cell after merge (the cartouche was drawn
// with skipPageNum, the global page index is only known once pages are
// merged). Reuses the exact primitive-drawing code so alignment/centering
// match the rest of the cartouche.
export function drawPageNumOnPdfPage(
  page,
  { layoutData, style = {}, fonts, text }
) {
  const t = layoutData?.texts?.find((entry) => entry.isPageNum);
  if (!t || !text) return;
  const pageHeight = page.getSize().height;
  drawTextPrimitive(
    page,
    pageHeight,
    { ...t, text },
    {
      fonts,
      labelColor: hexToRgb01(style.labelColor ?? "#888"),
      valueColor: hexToRgb01(style.valueColor ?? "#333"),
    }
  );
}

// Rasterize an image URL to PNG bytes via canvas (used for SVG logos, which
// pdf-lib cannot embed natively).
async function rasterizeImageUrlToPngBytes(url, scale = 2) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((img.naturalWidth || 100) * scale));
  canvas.height = Math.max(1, Math.round((img.naturalHeight || 100) * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!blob) throw new Error("toBlob() failed");
  return await blob.arrayBuffer();
}

// Embed a logo (object URL or data URL) into a pdf-lib document.
// PNG/JPG are embedded directly; anything else (SVG, webp...) is rasterized
// to PNG once via canvas.
export async function embedTitleBlockLogo(pdfDoc, url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const mime = res.headers.get("content-type") || "";
    const isSvg = /svg/i.test(mime) || /^data:image\/svg/i.test(url);
    const isJpg = /jpe?g/i.test(mime) || /^data:image\/jpe?g/i.test(url);
    if (!isSvg) {
      const bytes = await res.arrayBuffer();
      try {
        return isJpg
          ? await pdfDoc.embedJpg(bytes)
          : await pdfDoc.embedPng(bytes);
      } catch {
        // unsupported format for direct embed -> rasterize below
      }
    }
    const pngBytes = await rasterizeImageUrlToPngBytes(url);
    return await pdfDoc.embedPng(pngBytes);
  } catch (err) {
    console.warn("[titleBlocks] failed to embed logo in PDF", err);
    return null;
  }
}
