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
 * opts.spriteImage = {
 *   url: string,
 *   iconKeys: string[],
 *   columns: number,
 *   rows: number,
 *   tile: number // ex: 64
 * }
 *
 * opts.fontSizes = {
 *   label?: number,       // bold label in the grey comments box
 *   description?: number  // description in the grey comments box
 * }
 *
 * opts.chipFontSize?: number    // font size for the number text inside the white pill
 * opts.overlayIconSize?: number // icon size inside the pill (default 16)
 */
export default async function generateItemsGridPdf(items, opts = {}) {
  // ---- Page & grid
  const [pageW, pageH] = getPageWH(
    opts.pageSize || "A4",
    opts.orientation || "portrait"
  );
  const margin = opts.margin ?? 36;
  const contentW = pageW - margin * 2;

  const cols = 3;
  const gutter = opts.gutter ?? 12; // space between cards
  const cardW = Math.floor((contentW - gutter * (cols - 1)) / cols);

  // Card styles
  const cardBorder = opts.cardBorder ?? rgb(0.88, 0.88, 0.88);
  const cardPad = opts.cardPad ?? 0;

  // Pill overlay (number + icon) on image
  const overlayPadX = 8;
  const overlayPadXLeft = opts.chipPadXLeft ?? 6;
  const overlayPadXRight = opts.chipPadXRight ?? 4;
  const overlayPadY = opts.chipPadY ?? 2;
  const overlayGapFromEdge = 8;

  const chipTextSize = opts.chipFontSize ?? opts.numberSize ?? 12; // << new option
  const overlayIconSize = opts.overlayIconSize ?? 16;
  const overlayGapTextIcon = 8;
  const overlayTextColor = rgb(0.1, 0.1, 0.1);
  const chipBorder = Math.max(0, opts.chipBorder ?? 2);

  // Comments block (below each row)
  const notesGapAbove = 10;
  const notesPadX = 10;
  const notesPadY = 8;
  const notesBg = rgb(0.96, 0.96, 0.96);
  const notesTextColor = rgb(0.1, 0.1, 0.1);
  const notesBoldColor = rgb(0.05, 0.05, 0.05);

  // ---- Font sizes (label/description) configurable in comments box
  const fontSizes = opts.fontSizes || {};
  const notesLabelSize = fontSizes.label ?? 11; // bold “#num label”
  const notesDescSize = fontSizes.description ?? 11; // regular description
  const lhLabel = Math.round(notesLabelSize * 1.3);
  const lhDesc = Math.round(notesDescSize * 1.3);
  const firstLineLH = Math.max(lhLabel, lhDesc);

  // Icons (sprite)
  const iconRasterScale =
    opts.iconRasterScale ??
    (typeof window !== "undefined"
      ? Math.max(2, Math.min(4, window.devicePixelRatio || 1))
      : 3);
  const sprite = opts.spriteImage;
  const spriteEl = sprite?.url ? await loadHtmlImage(sprite.url) : null;

  // ---- Init PDF
  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ---- Caches
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
    return pdf.addPage([pageW, pageH]);
  }

  let page = newPage();
  let yCursor = pageH - margin;

  items = Array.isArray(items) ? items : [];

  // Process by rows of 3 cards
  for (let start = 0; start < items.length; start += cols) {
    const rowItems = items.slice(start, start + cols);

    // ---- Measure images per card & row height
    const perCard = [];
    let rowH = 0;

    for (let c = 0; c < rowItems.length; c++) {
      const it = rowItems[c] || {};
      const photo = await embedPhoto(it.imageUrl);
      let imgH;

      if (photo) {
        const n = photo.scale(1);
        imgH = Math.round((n.height / n.width) * (cardW - cardPad * 2));
      } else {
        // No background rectangle (as requested), keep a sane height:
        imgH = Math.round((cardW - cardPad * 2) * 0.6);
      }

      perCard.push({ it, photo, imgH });
      rowH = Math.max(rowH, imgH + cardPad * 2);
    }

    // ---- Measure comments block (under the row)
    const notesInnerW = contentW - notesPadX * 2;
    const notesLinesByItem = [];
    let notesH = notesPadY * 2;

    for (let c = 0; c < rowItems.length; c++) {
      const it = rowItems[c] || {};
      //const numberText = `#${it.number ?? ""}`;
      const numberText = `#${it.number ?? ""}`;
      const label = String(it.label ?? "");
      const desc = String(it.description ?? "");

      const prefix = label ? `${numberText} ${label}` : numberText;
      const maxPrefixW = Math.min(notesInnerW * 0.5, notesInnerW - 30);
      const prefixFitted = fitOneLine(
        prefix,
        fontBold,
        notesLabelSize,
        maxPrefixW
      );
      const prefixW = fontBold.widthOfTextAtSize(prefixFitted, notesLabelSize);

      let descLines = [];
      if (desc) {
        const firstLineMax = Math.max(0, notesInnerW - prefixW - 8);
        descLines = wrapTextWithFirstLineWidth(
          desc,
          fontRegular,
          notesDescSize,
          notesInnerW,
          firstLineMax
        );
      }

      let itemH = firstLineLH;
      if (descLines.length > 1) itemH += (descLines.length - 1) * lhDesc;

      notesLinesByItem.push({ prefixFitted, prefixW, descLines });
      notesH += itemH;
      if (c < rowItems.length - 1) notesH += 4;
    }

    // ---- Page break check (row + comments block together)
    const requiredH = rowH + notesGapAbove + notesH;
    if (yCursor - requiredH < margin) {
      page = newPage();
      yCursor = pageH - margin;
    }

    // ---- Draw row of cards
    const rowTop = yCursor;
    for (let c = 0; c < rowItems.length; c++) {
      const { it, photo, imgH } = perCard[c];

      const x = margin + c * (cardW + gutter);
      const innerX = x + cardPad;
      const innerYTop = rowTop - cardPad;

      if (cardPad > 0) {
        page.drawRectangle({
          x,
          y: innerYTop - (imgH + cardPad),
          width: cardW,
          height: imgH + cardPad * 2,
          borderColor: cardBorder,
          borderWidth: 1,
          color: rgb(1, 1, 1),
        });
      }

      const imgY = innerYTop - imgH;

      if (photo) {
        page.drawImage(photo, {
          x: innerX,
          y: imgY,
          width: cardW - cardPad * 2,
          height: imgH,
        });
      } else {
        // minimal hint text
        page.drawText("Image indisponible", {
          x: innerX + 8,
          y: imgY + 8,
          size: 10,
          font: fontRegular,
          color: rgb(0.45, 0.45, 0.45),
        });
      }

      // ===== WHITE PILL CHIP (number + optional icon) =====
      //const numberText = `# ${it.number ?? ""}`;
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
      const chipY = imgY + imgH - chipH - overlayGapFromEdge;

      // --- OUTER pill (acts as border), filled with fillColor
      const outerColor = hexToRgb01(it.fillColor || "#1976d2");
      drawPill(page, chipX, chipY, chipW, chipH, outerColor);

      // --- INNER pill (white), inset by chipBorder
      const inX = chipX + chipBorder;
      const inY = chipY + chipBorder;
      const inW = Math.max(1, chipW - chipBorder * 2);
      const inH = Math.max(1, chipH - chipBorder * 2);
      drawPill(page, inX, inY, inW, inH, rgb(1, 1, 1));

      // number text (centered vertically inside inner pill)
      const descent =
        typeof fontBold.descentAtSize === "function"
          ? fontBold.descentAtSize(chipTextSize) // negative value
          : -textH * 0.2; // fallback approximation

      const baselineY = Math.round(inY + (inH - textH) / 2 - descent);

      page.drawText(numberText, {
        x: Math.round(inX + overlayPadXLeft),
        y: baselineY,
        size: chipTextSize,
        font: fontBold,
        color: overlayTextColor,
      });

      // optional icon in pill (also relative to INNER pill)
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

    // advance cursor below row
    yCursor = rowTop - rowH;

    // ---- Comments block (grey, NO border)
    const notesTop = yCursor - notesGapAbove;
    const notesY = notesTop - notesH;

    page.drawRectangle({
      x: margin,
      y: notesY,
      width: contentW,
      height: notesH,
      color: notesBg,
      borderWidth: 0,
    });

    // Draw text lines
    let lineY = notesTop - notesPadY - Math.max(notesLabelSize, notesDescSize);
    for (let c = 0; c < rowItems.length; c++) {
      const it = rowItems[c] || {};
      const { prefixFitted, prefixW, descLines } = notesLinesByItem[c];
      const baseX = margin + notesPadX;

      // prefix (bold: "#num label")
      page.drawText(prefixFitted, {
        x: Math.round(baseX),
        y: Math.round(lineY),
        size: notesLabelSize,
        font: fontBold,
        color: notesBoldColor,
      });

      if (!descLines.length) {
        lineY -= firstLineLH + 4;
      } else {
        // first desc line on same baseline, to the right of prefix
        const first = descLines[0];
        const firstX = baseX + prefixW + 8;

        page.drawText(first, {
          x: Math.round(firstX),
          y: Math.round(lineY),
          size: notesDescSize,
          font: fontRegular,
          color: notesTextColor,
        });

        // next lines full width
        lineY -= firstLineLH;
        for (let l = 1; l < descLines.length; l++) {
          page.drawText(descLines[l], {
            x: Math.round(baseX),
            y: Math.round(lineY),
            size: notesDescSize,
            font: fontRegular,
            color: notesTextColor,
          });
          lineY -= lhDesc;
        }
        lineY -= 4;
      }
    }

    // after notes block
    yCursor = notesY - 16;
  }

  const pdfBytes = await pdf.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

/* ----------------- Helpers ----------------- */
// Draw a pill by composing a center rect + two semicircular caps
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

// Convert hex like "#7E57C2" to pdf-lib rgb()
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
  if (Array.isArray(pageSize) && pageSize.length === 2) {
    [w, h] = pageSize;
  } else if (pageSize === "A4") {
    w = 595.28;
    h = 841.89;
  } else if (pageSize === "Letter") {
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
        curMax = fullWidth; // next lines use full width
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

/* ---- Sprite helpers (browser) ---- */
function loadHtmlImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Create a sharp PNG (ArrayBuffer) for the sprite icon, rendered inside a colored disk.
 */
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

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(rasterScale, rasterScale);

  // colored circular background
  ctx.fillStyle = fillColor || "#1976d2";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // clip & draw sprite tile
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(spriteEl, sx, sy, tile, tile, 0, 0, size, size);
  ctx.restore();

  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  return await blob.arrayBuffer();
}
