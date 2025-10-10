// generateItemsGridPdf.js
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * items: Array<{
 *   number: number,
 *   label?: string,
 *   description?: string,
 *   imageUrl?: string,
 *   iconKey?: string,
 *   fillColor?: string
 * }>
 *
 * opts.spriteImage = { url, iconKeys, columns, rows, tile }
 * opts.fontSizes = { label?: number, description?: number }
 * opts.chipFontSize?: number
 * opts.overlayIconSize?: number
 * opts.sidebarWidthRatio?: number  // 0..1 (default 0.34)
 * opts.zoneGap?: number            // default 12
 */
export default async function generateItemsGridPdfVariantH(items, opts = {}) {
  const noImageS = "Pas d'image";

  // ==== Landscape page
  const [pageW, pageH] = getPageWH(opts.pageSize || "A4", "landscape");
  const margin = opts.margin ?? 36;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;

  // ==== Split layout (grid + right sidebar)
  const zoneGap = opts.zoneGap ?? 12;
  const sidebarRatio = Math.min(
    0.6,
    Math.max(0.22, opts.sidebarWidthRatio ?? 0.34)
  );
  const sidebarW = Math.round(contentW * sidebarRatio);
  const gridW = contentW - sidebarW - zoneGap;

  // ==== Grid 3x2
  const cols = 3;
  const rows = 2;
  const gutter = opts.gutter ?? 12;
  const cardW = Math.floor(gridW - gutter * (cols - 1));
  const cellW = Math.floor(cardW / cols);
  const cellH = Math.floor((contentH - gutter * (rows - 1)) / rows);

  const cardBorder = opts.cardBorder ?? rgb(0.88, 0.88, 0.88);
  const cardPad = opts.cardPad ?? 0;

  // ==== Number pill (top-left)
  const overlayPadXLeft = opts.chipPadXLeft ?? 6;
  const overlayPadXRight = opts.chipPadXRight ?? 4;
  const overlayPadY = opts.chipPadY ?? 2;
  const overlayGapFromEdge = 8;
  const chipTextSize = opts.chipFontSize ?? opts.numberSize ?? 12;
  const overlayIconSize = opts.overlayIconSize ?? 16;
  const overlayGapTextIcon = 8;
  const overlayTextColor = rgb(0.1, 0.1, 0.1);
  const chipBorder = Math.max(0, opts.chipBorder ?? 2);

  // ==== Sidebar (right)
  const notesPadX = 12;
  const notesPadY = 12;
  const notesBg = rgb(0.94, 0.94, 0.94);
  const notesTextColor = rgb(0.1, 0.1, 0.1);
  const notesBoldColor = rgb(0.05, 0.05, 0.05);

  const fontSizes = opts.fontSizes || {};
  const notesLabelSize = fontSizes.label ?? 12;
  const notesDescSize = fontSizes.description ?? 12;
  const lhLabel = Math.round(notesLabelSize * 1.3);
  const lhDesc = Math.round(notesDescSize * 1.3);
  const firstLineLH = Math.max(lhLabel, lhDesc);

  // ==== Sprite sheet (optional)
  const iconRasterScale =
    opts.iconRasterScale ??
    (typeof window !== "undefined"
      ? Math.max(2, Math.min(4, window.devicePixelRatio || 1))
      : 3);
  const sprite = opts.spriteImage;
  const spriteEl = sprite?.url ? await loadHtmlImage(sprite.url) : null;

  // ==== PDF init
  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ==== Caches
  const photoCache = new Map();
  const iconCache = new Map();

  async function embedPhoto(url) {
    if (!url) return null;
    if (photoCache.has(url)) return photoCache.get(url);
    try {
      const { bytes, type } = await fetchImageBytes(url);
      const img =
        type === "jpg" ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
      photoCache.set(url, img);
      return img;
    } catch {
      return null;
    }
  }

  async function embedIcon(iconKey, fillColor) {
    if (!sprite || !spriteEl || !iconKey) return null;
    const idx = sprite.iconKeys?.indexOf(iconKey);
    if (idx == null || idx < 0) return null;

    const cacheKey = `${iconKey}|${
      fillColor || ""
    }|${overlayIconSize}|${iconRasterScale}`;
    if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);

    const bytes = await makeSpriteIconPngBytes({
      spriteEl,
      spriteMeta: sprite,
      index: idx,
      size: overlayIconSize,
      fillColor: fillColor || "#1976d2",
      rasterScale: iconRasterScale,
    });
    const embedded = await pdf.embedPng(bytes);
    iconCache.set(cacheKey, embedded);
    return embedded;
  }

  function newPage() {
    const page = pdf.addPage([pageW, pageH]);
    // sidebar background
    page.drawRectangle({
      x: margin + gridW + zoneGap,
      y: margin,
      width: sidebarW,
      height: contentH,
      color: notesBg,
      borderWidth: 0,
    });
    return page;
  }

  items = Array.isArray(items) ? items : [];

  let i = 0;
  while (i < items.length) {
    // try up to 6 per page
    let slice = items.slice(i, i + cols * rows);

    // measure sidebar text to ensure it fits; otherwise reduce count
    const sidebarInnerW = sidebarW - notesPadX * 2;
    const measurements = slice.map((it) => {
      const numberText = `#${it.number ?? ""}`;
      const label = String(it.label ?? "");
      const desc = String(it.description ?? "");
      const prefix = label ? `${numberText} ${label}` : numberText;

      const maxPrefixW = Math.min(sidebarInnerW * 0.65, sidebarInnerW - 30);
      const prefixFitted = fitOneLine(
        prefix,
        fontBold,
        notesLabelSize,
        maxPrefixW
      );
      const prefixW = fontBold.widthOfTextAtSize(prefixFitted, notesLabelSize);

      const firstLineMax = Math.max(0, sidebarInnerW - prefixW - 8);
      const descLines = wrapTextWithFirstLineWidth(
        desc,
        fontRegular,
        notesDescSize,
        sidebarInnerW,
        firstLineMax
      );
      const h =
        firstLineLH +
        (descLines.length > 1 ? (descLines.length - 1) * lhDesc : 0) +
        8;
      return { prefixFitted, prefixW, descLines, h };
    });

    const maxH = contentH - notesPadY * 2;
    let sum = 0;
    let fitCount = 0;
    for (let k = 0; k < measurements.length; k++) {
      if (sum + measurements[k].h > maxH) break;
      sum += measurements[k].h;
      fitCount++;
    }
    if (fitCount === 0) fitCount = 1;
    if (fitCount < slice.length) slice = slice.slice(0, fitCount);

    const page = newPage();

    // === Grid (left)
    const gridX0 = margin;
    const gridY0 = margin;

    for (let n = 0; n < slice.length; n++) {
      const it = slice[n];
      const r = Math.floor(n / cols);
      const c = n % cols;

      const x = gridX0 + c * (cellW + gutter);
      const y = gridY0 + (rows - 1 - r) * (cellH + gutter);

      const innerX = x + cardPad;
      const innerY = y + cardPad;
      const innerW = cellW - cardPad * 2;
      const innerH = cellH - cardPad * 2;

      if (cardPad > 0) {
        page.drawRectangle({
          x,
          y,
          width: cellW,
          height: cellH,
          borderColor: cardBorder,
          borderWidth: 1,
          color: rgb(1, 1, 1),
        });
      }

      const photo = await embedPhoto(it.imageUrl);
      if (photo) {
        // contain
        const ratioImg = photo.height / photo.width;
        const ratioBox = innerH / innerW;
        let drawW = innerW,
          drawH = innerH,
          dx = innerX,
          dy = innerY;
        if (ratioImg > ratioBox) {
          drawH = innerH;
          drawW = Math.round(innerH / ratioImg);
          dx = innerX + Math.round((innerW - drawW) / 2);
        } else {
          drawW = innerW;
          drawH = Math.round(innerW * ratioImg);
          dy = innerY + Math.round((innerH - drawH) / 2);
        }
        page.drawImage(photo, { x: dx, y: dy, width: drawW, height: drawH });
      } else {
        page.drawText(noImageS, {
          x: innerX + 8,
          y: innerY + 8,
          size: 10,
          font: fontRegular,
          color: rgb(0.45, 0.45, 0.45),
        });
      }

      // === number pill
      const numberText = `${it.number ?? ""}`;
      const numW = fontBold.widthOfTextAtSize(numberText, chipTextSize);
      const iconW = it.iconKey ? overlayIconSize : 0;
      const chipW =
        overlayPadXLeft +
        numW +
        (iconW ? overlayGapTextIcon + iconW : 0) +
        overlayPadXRight;

      const textH = fontBold.heightAtSize(chipTextSize);
      const chipH = overlayPadY * 2 + Math.max(textH, overlayIconSize);
      const chipX = innerX + overlayGapFromEdge;
      const chipY = innerY + innerH - chipH - overlayGapFromEdge;

      const outerColor = hexToRgb01(it.fillColor || "#1976d2");
      drawPill(page, chipX, chipY, chipW, chipH, outerColor);

      const inX = chipX + chipBorder;
      const inY = chipY + chipBorder;
      const inW = Math.max(1, chipW - chipBorder * 2);
      const inH = Math.max(1, chipH - chipBorder * 2);
      drawPill(page, inX, inY, inW, inH, rgb(1, 1, 1));

      const descent =
        typeof fontBold.descentAtSize === "function"
          ? fontBold.descentAtSize(chipTextSize)
          : -textH * 0.2;
      const baselineY = Math.round(inY + (inH - textH) / 2 - descent);

      page.drawText(numberText, {
        x: Math.round(inX + overlayPadXLeft),
        y: baselineY,
        size: chipTextSize,
        font: fontBold,
        color: overlayTextColor,
      });

      if (it.iconKey) {
        const embeddedIcon = await embedIcon(it.iconKey, it.fillColor);
        if (embeddedIcon) {
          const iconX = Math.round(
            inX + overlayPadXLeft + numW + overlayGapTextIcon
          );
          const iconY = Math.round(inY + (inH - overlayIconSize) / 2);
          page.drawImage(embeddedIcon, {
            x: iconX,
            y: iconY,
            width: overlayIconSize,
            height: overlayIconSize,
          });
        }
      }
    }

    // === Sidebar text (right)
    const sideX = margin + gridW + zoneGap + notesPadX;
    const sideTop = margin + contentH - notesPadY;
    let y = sideTop;

    for (let k = 0; k < slice.length; k++) {
      const it = slice[k];
      const m = measurements[k];
      const baseY = y - Math.max(notesLabelSize, notesDescSize);

      page.drawText(m.prefixFitted, {
        x: Math.round(sideX),
        y: Math.round(baseY),
        size: notesLabelSize,
        font: fontBold,
        color: notesBoldColor,
      });

      if (m.descLines.length) {
        const first = m.descLines[0];
        const firstX = sideX + m.prefixW + 8;
        page.drawText(first, {
          x: Math.round(firstX),
          y: Math.round(baseY),
          size: notesDescSize,
          font: fontRegular,
          color: notesTextColor,
        });

        let lineY = baseY - firstLineLH;
        for (let l = 1; l < m.descLines.length; l++) {
          page.drawText(m.descLines[l], {
            x: Math.round(sideX),
            y: Math.round(lineY),
            size: notesDescSize,
            font: fontRegular,
            color: notesTextColor,
          });
          lineY -= lhDesc;
        }
      }

      y -= m.h;
    }

    i += slice.length;
  }

  const pdfBytes = await pdf.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

/* ----------------- Helpers ----------------- */
function drawPill(page, x, y, w, h, fillColorRgb) {
  const r = h / 2;
  const midW = Math.max(0, w - 2 * r);
  if (midW > 0) {
    page.drawRectangle({
      x: x + r,
      y,
      width: midW,
      height: h,
      color: fillColorRgb,
    });
  }
  page.drawEllipse({
    x: x + r,
    y: y + r,
    xScale: r,
    yScale: r,
    color: fillColorRgb,
  });
  page.drawEllipse({
    x: x + w - r,
    y: y + r,
    xScale: r,
    yScale: r,
    color: fillColorRgb,
  });
}

function hexToRgb01(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return rgb(0, 0, 0);
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  return rgb(r, g, b);
}

function getPageWH(pageSize, orientation) {
  let w = 595.28,
    h = 841.89; // A4
  if (Array.isArray(pageSize) && pageSize.length === 2) [w, h] = pageSize;
  else if (pageSize === "Letter") {
    w = 612;
    h = 792;
  }
  if (orientation === "landscape") return [h, w];
  return [w, h];
}

async function fetchImageBytes(url) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  const ct = res.headers.get("content-type") || "";
  const buf = await res.arrayBuffer();
  if (/jpe?g/i.test(ct) || /\.jpe?g(\?|$)/i.test(url))
    return { bytes: buf, type: "jpg" };
  return { bytes: buf, type: "png" };
}

function wrapTextWithFirstLineWidth(
  text,
  font,
  size,
  fullWidth,
  firstLineMaxWidth
) {
  if (!text) return [];
  const words = String(text).split(/\s+/).filter(Boolean);
  const out = [];
  let line = "";
  let isFirst = true;
  let curMax = Math.max(0, firstLineMaxWidth);

  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    const w = font.widthOfTextAtSize(test, size);
    if (w <= curMax) {
      line = test;
    } else {
      if (line) out.push(line);
      line = words[i];
      if (isFirst) {
        isFirst = false;
        curMax = fullWidth;
      }
    }
  }
  if (line) out.push(line);
  return out;
}

function fitOneLine(text, font, size, maxWidth) {
  const t = String(text || "");
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  const ellipsis = "…";
  let s = t;
  while (s.length && font.widthOfTextAtSize(s + ellipsis, size) > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + ellipsis;
}

function loadHtmlImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function makeSpriteIconPngBytes({
  spriteEl,
  spriteMeta,
  index,
  size,
  fillColor,
  rasterScale = 3,
}) {
  const { columns, tile } = spriteMeta;
  const col = index % columns;
  const row = Math.floor(index / columns);
  const sx = col * tile;
  const sy = row * tile;

  const W = Math.max(1, Math.round(size * rasterScale));
  const H = Math.max(1, Math.round(size * rasterScale));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(rasterScale, rasterScale);

  // colored disk
  ctx.fillStyle = fillColor || "#1976d2";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // clip + sprite
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(spriteEl, sx, sy, tile, tile, 0, 0, size, size);
  ctx.restore();

  const blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b), "image/png")
  );
  if (!blob) throw new Error("toBlob() failed");
  return await blob.arrayBuffer();
}
