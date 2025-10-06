import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * items: Array<{
 *   number: number,
 *   label?: string,
 *   description?: string,
 *   imageUrl?: string,
 *   iconKey?: string,   // -> affiche l'icône sprite entre #number et label
 *   fillColor?: string  // -> couleur de fond circulaire (ex: "#7E57C2")
 * }>
 *
 * opts.spriteImage = {
 *   url: string,
 *   iconKeys: string[],  // ordre des tuiles
 *   columns: number,
 *   rows: number,
 *   tile: number         // taille d’une tuile du sprite (px), ex: 64
 * }
 *
 * Retourne un Blob PDF prêt à télécharger.
 */
export default async function generateItemsGridPdf(items, opts = {}) {
  // ---- Mise en page
  const pageSize = opts.pageSize || "A4";
  const orientation = opts.orientation || "portrait";
  const [pageW, pageH] = getPageWH(pageSize, orientation);

  const margin = opts.margin ?? 36;
  const contentW = pageW - margin * 2;

  // image à droite: 25% de la largeur utile
  const imgRatioW = 0.25;
  const imgW = Math.floor(contentW * imgRatioW);

  const gapX = opts.gapX ?? 16; // espace texte <-> image
  const padX = opts.padX ?? 12; // padding interne section (x)
  const padY = opts.padY ?? 12; // padding interne section (y)
  const sectionStroke = rgb(0.8, 0.8, 0.8);
  const textColor = rgb(0.1, 0.1, 0.1);
  const numberColor = rgb(0.6, 0.6, 0.6);

  const numberSize = opts.numberSize ?? 10;
  const labelSize = opts.labelSize ?? 12;
  const bodySize = opts.bodySize ?? 10;
  const bodyLineH = Math.round(bodySize * 1.35);
  const titleGap = 6;

  // icône (sprite)
  const iconSize = opts.iconSize ?? 14;
  const iconGap = opts.iconGap ?? 8;
  // sur-échantillonnage pour netteté (2..4, basé sur DPR si dispo)
  const iconRasterScale =
    opts.iconRasterScale ??
    (typeof window !== "undefined"
      ? Math.max(2, Math.min(4, window.devicePixelRatio || 1))
      : 3);

  // largeur colonne texte
  const textW = contentW - padX * 2 - imgW - gapX;

  // ---- Init PDF
  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ---- Cache photos
  const photoCache = new Map();
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

  // ---- Sprite (HTMLImageElement pour recadrage via canvas)
  const sprite = opts.spriteImage;
  const spriteEl = sprite?.url ? await loadHtmlImage(sprite.url) : null;

  // Cache des icônes PDF embarquées
  const iconCache = new Map();
  async function embedIcon(iconKey, fillColor) {
    if (!sprite || !spriteEl || !iconKey) return null;
    const idx = sprite.iconKeys?.indexOf(iconKey);
    if (idx == null || idx < 0) return null;

    const cacheKey = `${iconKey}|${
      fillColor || ""
    }|${iconSize}|${iconRasterScale}`;
    if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);

    const bytes = await makeSpriteIconPngBytes({
      spriteEl,
      spriteMeta: sprite,
      index: idx,
      size: iconSize,
      fillColor: fillColor || "#d32f2f",
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
  let yCursor = pageH - margin; // on descend

  items = Array.isArray(items) ? items : [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    const label = it.label ?? it.title ?? "";
    const numberText = `# ${it.number ?? ""}`;
    const descText = it.description ? String(it.description) : "";
    const hasIcon = Boolean(it.iconKey);

    // dimensions du titre
    const numW = fontRegular.widthOfTextAtSize(numberText, numberSize);
    const afterNumGap = 12;

    const iconWForLabel = hasIcon ? iconSize + iconGap : 0;
    const maxLabelW = Math.max(0, textW - numW - afterNumGap - iconWForLabel);
    const labelOneLine = fitOneLine(label, fontBold, labelSize, maxLabelW);

    // description (wrap)
    let descLines = wrapText(descText, fontRegular, bodySize, textW, Infinity);
    let textContentH = labelSize + titleGap + descLines.length * bodyLineH;

    // photo à droite
    const photo = await embedPhoto(it.imageUrl);
    let imgH = 0;
    if (photo) {
      const natural = photo.scale(1);
      imgH = Math.round((natural.height / natural.width) * imgW);
    }

    // hauteur de la section
    let contentH = Math.max(textContentH, imgH);
    let sectionH = contentH + padY * 2;

    // saut de page si nécessaire
    if (yCursor - sectionH < margin) {
      page = newPage();
      yCursor = pageH - margin;

      // si toujours trop haut: tronque la description pour tenir sur une page
      const maxContentH = pageH - margin * 2 - padY * 2;
      if (contentH > maxContentH) {
        const maxDescLines = Math.max(
          0,
          Math.floor((maxContentH - labelSize - titleGap) / bodyLineH)
        );
        descLines = wrapText(
          descText,
          fontRegular,
          bodySize,
          textW,
          maxDescLines
        );
        textContentH = labelSize + titleGap + descLines.length * bodyLineH;
        contentH = Math.max(textContentH, imgH);
        sectionH = contentH + padY * 2;
      }
    }

    // container + ligne de séparation bas
    const secX = margin;
    const secY = yCursor - sectionH;

    page.drawRectangle({
      x: secX,
      y: secY,
      width: contentW,
      height: sectionH,
      color: rgb(1, 1, 1),
      borderColor: sectionStroke,
      borderWidth: 1,
    });

    page.drawLine({
      start: { x: secX, y: secY },
      end: { x: secX + contentW, y: secY },
      thickness: 1,
      color: sectionStroke,
    });

    // coordonnées internes
    const innerLeft = secX + padX;
    const innerTop = yCursor - padY;

    // Colonne texte
    const textX = innerLeft;
    const labelBaselineY = innerTop - labelSize;
    const numberBaselineY = labelBaselineY;

    // numéro (gris)
    page.drawText(numberText, {
      x: Math.round(textX),
      y: Math.round(numberBaselineY),
      size: numberSize,
      font: fontRegular,
      color: numberColor,
    });

    // icône optionnelle
    let iconDrawnW = 0;
    if (hasIcon) {
      const embeddedIcon = await embedIcon(it.iconKey, it.fillColor);
      if (embeddedIcon) {
        const iconX = Math.round(textX + numW + afterNumGap);
        const iconY = Math.round(labelBaselineY - (iconSize - labelSize) / 2);
        page.drawImage(embeddedIcon, {
          x: iconX,
          y: iconY,
          width: iconSize,
          height: iconSize,
        });
        iconDrawnW = iconSize + iconGap;
      }
    }

    // label (gras)
    page.drawText(labelOneLine, {
      x: Math.round(textX + numW + afterNumGap + iconDrawnW),
      y: Math.round(labelBaselineY),
      size: labelSize,
      font: fontBold,
      color: textColor,
    });

    // description (wrap)
    let descY = labelBaselineY - titleGap - bodySize; // baseline 1re ligne
    for (const line of descLines) {
      page.drawText(line, {
        x: Math.round(textX),
        y: Math.round(descY),
        size: bodySize,
        font: fontRegular,
        color: textColor,
      });
      descY -= bodyLineH;
    }

    // Image (droite)
    if (photo) {
      const imgX = Math.round(secX + contentW - padX - imgW);
      const imgY = Math.round(innerTop - imgH);
      page.drawImage(photo, { x: imgX, y: imgY, width: imgW, height: imgH });
    }

    // avance le curseur
    yCursor = secY;
  }

  const pdfBytes = await pdf.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

/* ---------- Helpers ---------- */

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

function wrapText(text, font, size, maxWidth, maxLines = Infinity) {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let line = "";

  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    const w = font.widthOfTextAtSize(test, size);
    if (w <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = words[i];
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);

  // ellipse si tronqué
  const full = lines.join(" ").trim() === words.join(" ").trim();
  if (!full && lines.length) {
    const ellipsis = "…";
    let last = lines[lines.length - 1];
    while (
      last.length &&
      font.widthOfTextAtSize(last + ellipsis, size) > maxWidth
    ) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = last + ellipsis;
  }
  return lines;
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
    img.crossOrigin = "anonymous"; // nécessite CORS si cross-origin
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Génère un PNG (ArrayBuffer) net en recadrant la tuile du sprite dans un canvas
 * sur-échantillonné, puis en l’exportant. Rendu dans un disque coloré (fillColor).
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

  // Canvas haute résolution
  const W = Math.max(1, Math.round(size * rasterScale));
  const H = Math.max(1, Math.round(size * rasterScale));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // qualité
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Espace utilisateur en "px CSS"
  ctx.scale(rasterScale, rasterScale);

  // fond circulaire
  ctx.fillStyle = fillColor || "#d32f2f";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // clip cercle + tuile
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(spriteEl, sx, sy, tile, tile, 0, 0, size, size);
  ctx.restore();

  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  return await blob.arrayBuffer();
}
