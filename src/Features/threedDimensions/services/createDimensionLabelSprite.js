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
// is off, so the sprite keeps a constant size regardless of camera distance).
const CARD_SCREEN_HEIGHT = 0.04;

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

// Build a camera-facing, CLICKABLE card sprite showing a dimension's length
// (e.g. "2.45 m"). Unlike the mesh-cell label, raycast is left enabled so the
// MainThreedEditor click handler can pick it for selection. `userData.coteId`
// carries the dimension id; `userData.dispose` frees the texture/material.
//
// `color` is the cote's display color (border + text). `selected` thickens the
// border and tints the background so the user sees which cote is selected.
export default function createDimensionLabelSprite({
  text,
  coteId,
  color = DEFAULT_COTE_COLOR,
  selected = false,
}) {
  const label = text || "";

  const borderColor = color;
  const textColor = color;
  const fillBg = selected ? safeLighten(color, 0.85, "#e3f2fd") : "#ffffff";

  const s = CANVAS_SCALE;
  const titleFontPx = 24 * s;
  const padX = 14 * s;
  const padY = 10 * s;
  const radius = 9 * s;
  const borderWidth = (selected ? 5 : 3) * s;

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  const font = `bold ${titleFontPx}px sans-serif`;
  mctx.font = font;
  const textW = mctx.measureText(label).width;

  const canvasW = Math.ceil(textW + padX * 2);
  const canvasH = Math.ceil(titleFontPx + padY * 2);

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
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
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
  sprite.scale.set(CARD_SCREEN_HEIGHT * aspect, CARD_SCREEN_HEIGHT, 1);
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
