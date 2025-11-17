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
 * opts.logoImage = { url: string }     // logo du header
 * opts.title = string                  // titre au centre du header
 * opts.headerTitleSize?: number        // taille du titre du header
 *
 * opts.spriteImage = { url, iconKeys, columns, rows, tile } // optionnel pour les icônes
 * opts.fontSizes = { label?: number, description?: number }
 * opts.numberSize?: number
 * opts.headerHeight?: number
 * opts.margin?: number
 */
const ISSUE_SPACING = 8;

export default async function generateItemsGridPdfVariantH(items, opts = {}) {
  items = Array.isArray(items) ? items : [];

  // ==== Page
  const [pageW, pageH] = getPageWH(opts.pageSize || "A4", "portrait");
  const margin = opts.margin ?? 36;
  const contentW = pageW - margin * 2;

  // ==== Fonts
  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ==== Styles
  const fontSizes = opts.fontSizes || {};
  const labelSize = fontSizes.label ?? 14;
  const descSize = fontSizes.description ?? 11;
  const numberSize = opts.numberSize ?? 12;
  const headerTitleSize = opts.headerTitleSize ?? 22;
  const headerHeight = opts.headerHeight ?? 60;
  const headerMargin = 16;
  const separatorColor = rgb(0.85, 0.85, 0.85);
  const textColor = rgb(0.1, 0.1, 0.1);
  const labelColor = rgb(0.0, 0.0, 0.0);
  const numberColor = rgb(0.6, 0.6, 0.6); // gris clair comme sur la maquette

  const lineHeightLabel = Math.round(labelSize * 1.3);
  const lineHeightDesc = Math.round(descSize * 1.3);

  // ==== Icon / sprite
  const overlayIconSize = opts.overlayIconSize ?? 16;
  const iconRasterScale =
    opts.iconRasterScale ??
    (typeof window !== "undefined"
      ? Math.max(2, Math.min(4, window.devicePixelRatio || 1))
      : 3);
  const sprite = opts.spriteImage;
  const spriteEl = sprite?.url ? await loadHtmlImage(sprite.url) : null;

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

  // ==== Logo
  let logoImg = null;
  if (opts.logoImage?.url) {
    logoImg = await embedPhoto(opts.logoImage.url);
  }

  // ==== Header + nouvelle page
  function addPageWithHeader() {
    const page = pdf.addPage([pageW, pageH]);

    const headerWidth = pageW - headerMargin * 2;
    const headerLeft = headerMargin;
    const headerRight = pageW - headerMargin;
    const headerTopY = pageH - headerMargin;
    const headerBottomY = headerTopY - headerHeight;

    // ⚠️ plus de ligne sous le titre : on laisse la page propre.

    // logo à gauche
    if (logoImg) {
      const maxLogoH = headerHeight - 10;
      const maxLogoW = 100;
      const ratio = Math.min(
        maxLogoW / logoImg.width,
        maxLogoH / logoImg.height
      );
      const drawW = logoImg.width * ratio;
      const drawH = logoImg.height * ratio;
      const logoX = headerLeft;
      const logoY = headerBottomY + (headerHeight - drawH) / 2;
      page.drawImage(logoImg, {
        x: logoX,
        y: logoY,
        width: drawW,
        height: drawH,
      });
    }

    // titre centré
    const title = opts.title || "Titre";
    const titleWidth = fontBold.widthOfTextAtSize(title, headerTitleSize);
    const titleX = Math.max(
      headerLeft,
      Math.min(headerRight - titleWidth, (pageW - titleWidth) / 2)
    );
    const titleY = headerBottomY + (headerHeight - headerTitleSize) / 2;
    page.drawText(title, {
      x: titleX,
      y: titleY,
      size: headerTitleSize,
      font: fontBold,
      color: labelColor,
    });

    // position de départ pour le contenu
    const bodyTopY = headerBottomY - 20;
    return { page, bodyTopY };
  }

  // ==== Helpers de mesure / rendu
  function wrapText(text, font, size, maxWidth) {
    if (!text) return [];
    const rawLines = String(text).split(/\r?\n/);
    const lines = [];

    rawLines.forEach((rawLine) => {
      const words = rawLine.split(/\s+/).filter(Boolean);
      let currentLine = "";

      if (words.length === 0) {
        lines.push("");
        return;
      }

      words.forEach((word) => {
        const test = currentLine ? `${currentLine} ${word}` : word;
        const w = font.widthOfTextAtSize(test, size);
        if (w <= maxWidth || !currentLine) {
          currentLine = test;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      });

      if (currentLine) {
        lines.push(currentLine);
      } else {
        lines.push("");
      }
    });

    return lines;
  }

  function measureIssue(item, photo) {
    // bloc image = 1/3 de la largeur
    const hasPhoto = !!photo;
    const imageW = hasPhoto ? contentW / 3 : 0;
    const textW = hasPhoto ? contentW - imageW - ISSUE_SPACING : contentW;

    const desc = sanitizeText(item.description);
    const descLines = wrapText(desc, fontRegular, descSize, textW);

    const hasLabel = !!item.label;
    let textHeight = 0;
    if (hasLabel) textHeight += lineHeightLabel;
    if (descLines.length) textHeight += descLines.length * lineHeightDesc;

    let imageH = 0;
    if (hasPhoto) {
      const scale = imageW / photo.width;
      imageH = photo.height * scale;
    }

    const contentHeight = Math.max(textHeight, imageH);
    // marge interne + numéro + espace sous la ligne
    const textOnlyPadding = hasPhoto ? ISSUE_SPACING : ISSUE_SPACING * 2;
    const totalHeight = contentHeight + ISSUE_SPACING + textOnlyPadding;

    return {
      imageW,
      imageH,
      textW,
      descLines,
      contentHeight,
      totalHeight,
    };
  }

  function drawIssue(page, item, photo, icon, yTop, meas) {
    const { imageW, imageH, descLines, totalHeight } = meas;

    // ligne de séparation
    const separatorY = yTop;
    page.drawLine({
      start: { x: margin, y: separatorY },
      end: { x: pageW - margin, y: separatorY },
      thickness: 1,
      color: separatorColor,
    });

    const contentTopY = separatorY - ISSUE_SPACING; // petite marge après la ligne

    // zone text / image
    const hasPhoto = !!photo;
    const textX = margin;
    const imageX = margin + contentW - imageW;

    // --- Ligne d'en-tête de l'issue: numéro + icône + titre
    const numberText =
      typeof item.number === "number" ? `# ${item.number}` : "";
    const numSize = numberSize;
    const headerBaselineY = contentTopY - numSize;

    let curX = textX;

    // numéro (# 14)
    if (numberText) {
      page.drawText(numberText, {
        x: curX,
        y: headerBaselineY,
        size: numSize,
        font: fontBold,
        color: numberColor,
      });
      const numW = fontBold.widthOfTextAtSize(numberText, numSize);
      curX += numW + 8;
    }

    // icône (issue marker)
    if (icon) {
      const iconY = headerBaselineY - (overlayIconSize - numSize) / 2;
      page.drawImage(icon, {
        x: curX,
        y: iconY,
        width: overlayIconSize,
        height: overlayIconSize,
      });
      curX += overlayIconSize + 6;
    }

    // titre de l'issue
    if (item.label) {
      page.drawText(sanitizeText(item.label), {
        x: curX,
        y: headerBaselineY,
        size: labelSize,
        font: fontBold,
        color: labelColor,
      });
    }

    // description, sous le titre (alignée avec le label / icône / numéro)
    let textY = headerBaselineY;
    if (item.label) {
      textY -= lineHeightLabel + 6;
    }
    for (const line of descLines) {
      page.drawText(line, {
        x: curX,
        y: textY,
        size: descSize,
        font: fontRegular,
        color: textColor,
      });
      textY -= lineHeightDesc;
    }

    // image à droite, alignée en haut du bloc
    if (photo) {
      const imgY = contentTopY - imageH;
      page.drawImage(photo, {
        x: imageX,
        y: imgY,
        width: imageW,
        height: imageH,
      });
    }

    // nouvelle position Y pour l'issue suivante
    return separatorY - totalHeight;
  }

  // ==== Génération des pages
  let { page, bodyTopY } = addPageWithHeader();
  let cursorY = bodyTopY;
  const bottomLimit = margin + 20;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];

    const photo = await embedPhoto(item.imageUrl);
    const icon = await embedIcon(item.iconKey, item.fillColor);
    const meas = measureIssue(item, photo);

    // si la prochaine issue ne tient pas, nouvelle page
    if (cursorY - meas.totalHeight < bottomLimit) {
      ({ page, bodyTopY } = addPageWithHeader());
      cursorY = bodyTopY;
    }

    cursorY = drawIssue(page, item, photo, icon, cursorY, meas);
  }

  const pdfBytes = await pdf.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

/* ----------------- Helpers ----------------- */

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

  // disque coloré
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

function sanitizeText(text) {
  if (!text) return "";
  const str = String(text);
  let result = "";
  for (const char of str) {
    const code = char.codePointAt(0);
    if (code != null && code <= 0xff) {
      result += char;
    }
  }
  return result;
}
