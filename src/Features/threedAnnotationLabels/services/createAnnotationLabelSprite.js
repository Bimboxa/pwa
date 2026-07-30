import {
  CanvasTexture,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  LinearFilter,
} from "three";

import { ANNOTATION_LABEL_FONT_SIZES_PX } from "Features/annotations/utils/getAnnotationLabelDisplay";

import sizeSpriteInCssPx from "./sizeSpriteInCssPx";

// Same recipe as createMesh3dLabelSprite (rounded card, constant on-screen
// size, clickable) but with the multi-line content of the annotation label
// (template label / annotation label / description — getAnnotationLabelTextLines),
// shared with the 2D chip (NodeLabelStatic).

// Supersampling of the card canvas (drawn big, displayed small).
const CANVAS_SCALE = 4;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Word-wrap `text` (manual \n respected) so each physical line fits maxW
// canvas px. maxW = null disables wrapping.
function wrapLine(mctx, text, font, maxW) {
  mctx.font = font;
  const out = [];
  for (const raw of String(text).split("\n")) {
    if (!maxW) {
      out.push(raw);
      continue;
    }
    const words = raw.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let cur = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = cur + " " + words[i];
      if (mctx.measureText(test).width > maxW) {
        out.push(cur);
        cur = words[i];
      } else {
        cur = test;
      }
    }
    out.push(cur);
  }
  return out;
}

/**
 * Camera-facing, CLICKABLE card sprite for an annotation label.
 * `lines`: [{kind: "TEMPLATE"|"LABEL"|"DESCRIPTION", text}] — TEMPLATE and
 * LABEL lines render bold, DESCRIPTION smaller and normal weight.
 * `fontSizePreset`: "S" | "M" | "L" (Etiquette tab), scales the whole card.
 * `labelWidth`: 2D chip width in CSS px (resize handle) — the card wraps its
 * text at the equivalent width so both views show the same layout.
 */
export default function createAnnotationLabelSprite({
  lines,
  annotationId,
  color = "#2196f3",
  fontSizePreset = "M",
  labelWidth = null,
  selected = false,
}) {
  const textLines = (lines || []).filter((l) => l?.text);
  if (!textLines.length) return null;

  const borderColor = color;
  const textColor = "#000000";
  // Pure white card, matching the 2D chip; selection reads from the thicker
  // border, not a tinted background.
  const fillBg = "#ffffff";

  const s = CANVAS_SCALE;
  const titleFontPx = 22 * s;
  // Same title/description ratio as the 2D chip (fontSize * 0.85).
  const subFontPx = Math.round(titleFontPx * 0.85);
  const padX = 14 * s;
  const padY = 10 * s;
  const lineGap = 5 * s;
  const radius = 9 * s;
  const borderWidth = (selected ? 5 : 3) * s;

  const fontOf = (line) =>
    line.kind === "DESCRIPTION"
      ? `${subFontPx}px sans-serif`
      : `bold ${titleFontPx}px sans-serif`;
  const heightOf = (line) =>
    line.kind === "DESCRIPTION" ? subFontPx : titleFontPx;

  // Canvas px ↔ 2D chip CSS px: the title is drawn at `titleFontPx` canvas px
  // and must end up measuring exactly the 2D font size on screen, so the whole
  // card is later sized in CSS px through this ratio (see sizeSpriteInCssPx).
  // This is also what makes S / M / L match the 2D presets.
  const fontSizePx =
    ANNOTATION_LABEL_FONT_SIZES_PX[fontSizePreset] ??
    ANNOTATION_LABEL_FONT_SIZES_PX.M;
  const cssToCanvas = titleFontPx / fontSizePx;
  const CHIP_PADDING_X_CSS = 8;
  // Mirror of the 2D layout: fixed width wraps everything, otherwise only the
  // description wraps (2D caps it at 180 px).
  const fixedMaxW = labelWidth
    ? (labelWidth - 2 * CHIP_PADDING_X_CSS) * cssToCanvas
    : null;
  const descriptionMaxW = fixedMaxW ?? 180 * cssToCanvas;

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");

  // Physical render lines after word-wrap.
  const renderLines = textLines.flatMap((line) => {
    const maxW = line.kind === "DESCRIPTION" ? descriptionMaxW : fixedMaxW;
    return wrapLine(mctx, line.text, fontOf(line), maxW).map((text) => ({
      text,
      kind: line.kind,
    }));
  });

  let textW = 0;
  renderLines.forEach((line) => {
    mctx.font = fontOf(line);
    textW = Math.max(textW, mctx.measureText(line.text).width);
  });
  if (fixedMaxW) textW = Math.max(textW, fixedMaxW);

  // Vertical gap above line `i`: the description block gets extra breathing
  // room after the template/label lines (mirrors the 2D chip's marginTop).
  const firstDescriptionIndex = renderLines.findIndex(
    (l) => l.kind === "DESCRIPTION"
  );
  const gapBefore = (i) => {
    if (i === 0) return 0;
    return i === firstDescriptionIndex ? lineGap + 6 * cssToCanvas : lineGap;
  };

  const textH =
    renderLines.reduce((acc, line) => acc + heightOf(line), 0) +
    renderLines.reduce((acc, _line, i) => acc + gapBefore(i), 0);
  const canvasW = Math.ceil(textW + padX * 2);
  const canvasH = Math.ceil(textH + padY * 2);

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");

  const inset = borderWidth / 2;
  roundRect(
    ctx,
    inset,
    inset,
    canvasW - borderWidth,
    canvasH - borderWidth,
    radius
  );
  ctx.fillStyle = fillBg;
  ctx.fill();
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let y = padY;
  renderLines.forEach((line, i) => {
    const h = heightOf(line);
    y += gapBefore(i);
    ctx.font = fontOf(line);
    ctx.fillText(line.text, canvasW / 2, y + h / 2);
    y += h;
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    // Depth-aware: the card is truncated by 3D objects in front of it.
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: false,
    // Skip tone mapping so the white background stays pure white on screen.
    toneMapped: false,
  });

  const sprite = new Sprite(material);
  // Sized in CSS px like the 2D chip: the canvas is drawn at `cssToCanvas`
  // times the 2D geometry, so dividing by it gives the card height the 2D chip
  // would have — text included, whatever the line count and the fov.
  sizeSpriteInCssPx(sprite, {
    cssHeight: canvasH / cssToCanvas,
    aspect: canvasW / canvasH,
  });
  sprite.renderOrder = 1003;

  sprite.userData = {
    annotationId,
    isAnnotationLabel: true,
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };

  return sprite;
}
