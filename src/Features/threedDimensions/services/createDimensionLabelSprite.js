import {
  CanvasTexture,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  LinearFilter,
} from "three";
import { lighten } from "@mui/material/styles";

import { DEFAULT_COTE_COLOR } from "../utils/coteConstants";

function safeLighten(color, amount, fallback) {
  try {
    return lighten(color, amount);
  } catch {
    return fallback;
  }
}

// On-screen card height as a fraction of the viewport height (sizeAttenuation
// is off, so the sprite keeps a constant size regardless of camera distance)
// at the reference font size.
const CARD_SCREEN_HEIGHT = 0.04;
// The cote / ruler `fontSize` (page pt in 2D) scales the sprite linearly:
// 18 pt (the COTE default) is the historical 3D size.
const REFERENCE_FONT_SIZE_PT = 18;

// Supersampling factor for crisp canvas text at high DPI.
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

// Build a camera-facing, CLICKABLE sprite showing a dimension's length
// (e.g. "2.45 m"). Unlike the mesh-cell label, raycast is left enabled so the
// MainThreedEditor click handler can pick it for selection. `userData.coteId`
// carries the dimension id; `userData.dispose` frees the texture/material.
//
// `color` is the cote's display color (border + text). `card` (the
// `showValueCard` setting of COTE / RULER): true draws the value in a
// rounded card; false draws the bare value with a white halo around the
// coloured text, so it stays legible on a dark face (same reading as the
// 2D renderers' halo). `fontSize` (the COTE / RULER setting, page pt in 2D)
// scales the whole sprite on screen. `selected` thickens the card's border
// and tints its background. `emphasis` inverts the colours (the one value card of a
// selected cote / ruler that is itself sub-selected): a filled card, or
// without a card white text in a coloured halo.
export default function createDimensionLabelSprite({
  text,
  coteId,
  color = DEFAULT_COTE_COLOR,
  selected = false,
  emphasis = false,
  card = true,
  fontSize = REFERENCE_FONT_SIZE_PT,
}) {
  const label = text || "";

  const s = CANVAS_SCALE;
  const titleFontPx = 24 * s;
  const padX = 14 * s;
  const padY = 10 * s;
  const radius = 9 * s;
  const borderWidth = (selected || emphasis ? 5 : 3) * s;
  // Halo of the bare value: thick enough to isolate the glyphs from any
  // background, drawn under the fill (stroke first).
  const haloWidth = 6 * s;
  const haloPad = haloWidth;

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  const font = `bold ${titleFontPx}px sans-serif`;
  mctx.font = font;
  const textW = mctx.measureText(label).width;

  // The card's canvas height is the on-screen reference: the bare value
  // keeps the same glyph size on screen (its canvas is only as tall as the
  // text + halo, the sprite is scaled down accordingly).
  const cardCanvasH = Math.ceil(titleFontPx + padY * 2);
  const canvasW = Math.ceil(textW + (card ? padX : haloPad) * 2);
  const canvasH = card ? cardCanvasH : Math.ceil(titleFontPx + haloPad * 2);

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");

  if (card) {
    const fillBg = emphasis
      ? color
      : selected
        ? safeLighten(color, 0.85, "#e3f2fd")
        : "#ffffff";
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
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (!card) {
    ctx.lineJoin = "round";
    ctx.lineWidth = haloWidth;
    ctx.strokeStyle = emphasis ? color : "#ffffff";
    ctx.strokeText(label, canvasW / 2, canvasH / 2);
  }
  ctx.fillStyle = emphasis ? "#ffffff" : color;
  ctx.fillText(label, canvasW / 2, canvasH / 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
  });

  const sprite = new Sprite(material);
  const aspect = canvasW / canvasH;
  const fontScale =
    Number.isFinite(fontSize) && fontSize > 0
      ? fontSize / REFERENCE_FONT_SIZE_PT
      : 1;
  const screenH = (CARD_SCREEN_HEIGHT * fontScale * canvasH) / cardCanvasH;
  sprite.scale.set(screenH * aspect, screenH, 1);
  // Draw on top of meshes/lines so the card is never hidden.
  sprite.renderOrder = 1003;

  sprite.userData = {
    coteId,
    isDimensionLabel: true,
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };

  return sprite;
}
