import {
  CanvasTexture,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  LinearFilter,
} from "three";
import { lighten } from "@mui/material/styles";

import { DEFAULT_MESH3D_COLOR } from "../utils/mesh3dConstants";

function safeLighten(color, amount, fallback) {
  try {
    return lighten(color, amount);
  } catch {
    return fallback;
  }
}

// Same recipe as createDimensionLabelSprite (rounded card, constant on-screen
// size, clickable) with an optional second line: when the maille is selected
// the card also shows its surface under the label.

const CARD_SCREEN_HEIGHT = 0.04;
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

/**
 * Camera-facing, CLICKABLE card sprite for a maille label ("M-3", plus
 * "46.2 m²" when selected). `userData.mesh3dId` carries the maille id.
 */
export default function createMesh3dLabelSprite({
  text,
  surfaceText = null,
  mesh3dId,
  color = DEFAULT_MESH3D_COLOR,
  selected = false,
}) {
  const label = text || "";

  const borderColor = color;
  const textColor = color;
  const fillBg = selected ? safeLighten(color, 0.85, "#e3f2fd") : "#ffffff";

  const s = CANVAS_SCALE;
  const titleFontPx = 24 * s;
  const subFontPx = 17 * s;
  const padX = 14 * s;
  const padY = 10 * s;
  const lineGap = 4 * s;
  const radius = 9 * s;
  const borderWidth = (selected ? 5 : 3) * s;

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  const titleFont = `bold ${titleFontPx}px sans-serif`;
  const subFont = `${subFontPx}px sans-serif`;
  mctx.font = titleFont;
  let textW = mctx.measureText(label).width;
  if (surfaceText) {
    mctx.font = subFont;
    textW = Math.max(textW, mctx.measureText(surfaceText).width);
  }

  const canvasW = Math.ceil(textW + padX * 2);
  const canvasH = Math.ceil(
    titleFontPx + (surfaceText ? lineGap + subFontPx : 0) + padY * 2
  );

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
  if (surfaceText) {
    ctx.font = titleFont;
    ctx.fillText(label, canvasW / 2, padY + titleFontPx / 2);
    ctx.font = subFont;
    ctx.fillText(
      surfaceText,
      canvasW / 2,
      padY + titleFontPx + lineGap + subFontPx / 2
    );
  } else {
    ctx.font = titleFont;
    ctx.fillText(label, canvasW / 2, canvasH / 2);
  }

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
  const screenH = surfaceText ? CARD_SCREEN_HEIGHT * 1.5 : CARD_SCREEN_HEIGHT;
  sprite.scale.set(screenH * aspect, screenH, 1);
  sprite.renderOrder = 1003;

  sprite.userData = {
    mesh3dId,
    isMesh3dLabel: true,
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };

  return sprite;
}
