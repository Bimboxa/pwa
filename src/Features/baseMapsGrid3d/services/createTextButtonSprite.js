import {
  CanvasTexture,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from "three";

import sizeSpriteInCssPx from "Features/threedAnnotationLabels/services/sizeSpriteInCssPx";

// Pill-shaped text button drawn in the 3D scene (white pill + a short
// label), constant on-screen size (CSS px) — the text counterpart of
// createIconSprite.
//
// The canvas is drawn at CANVAS_SCALE × the CSS size so it stays crisp on
// high-dpi screens.

const CANVAS_SCALE = 4;
const BORDER_PX = 1;
const PADDING_X_RATIO = 0.55; // of the CSS height
const FONT_RATIO = 0.46; // of the CSS height

// Returns { sprite, dispose() }.
export default function createTextButtonSprite({
  text,
  cssHeight = 28,
  color = "#424242",
  background = "#ffffff",
  border = "rgba(0,0,0,0.25)",
  compensateParentScale = false,
}) {
  const fontPx = cssHeight * FONT_RATIO * CANVAS_SCALE;
  const font = `600 ${fontPx}px sans-serif`;
  const measureCtx = document.createElement("canvas").getContext("2d");
  measureCtx.font = font;
  const padX = cssHeight * PADDING_X_RATIO * CANVAS_SCALE;
  const height = Math.ceil(cssHeight * CANVAS_SCALE);
  const width = Math.ceil(measureCtx.measureText(text).width + padX * 2);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, width);
  canvas.height = Math.max(2, height);
  const ctx = canvas.getContext("2d");

  // pill
  const inset = (BORDER_PX * CANVAS_SCALE) / 2 + 1;
  const radius = canvas.height / 2 - inset;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(
      inset,
      inset,
      canvas.width - inset * 2,
      canvas.height - inset * 2,
      radius
    );
  } else {
    ctx.rect(inset, inset, canvas.width - inset * 2, canvas.height - inset * 2);
  }
  ctx.fillStyle = background;
  ctx.fill();
  ctx.lineWidth = BORDER_PX * CANVAS_SCALE;
  ctx.strokeStyle = border;
  ctx.stroke();

  // label
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
    toneMapped: false,
  });

  const sprite = new Sprite(material);
  sizeSpriteInCssPx(sprite, {
    cssHeight,
    aspect: canvas.width / canvas.height,
    compensateParentScale,
  });

  return {
    sprite,
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };
}
