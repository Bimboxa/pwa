import {
  CanvasTexture,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from "three";

import sizeSpriteInCssPx from "Features/threedAnnotationLabels/services/sizeSpriteInCssPx";

// Pill-shaped text button drawn in the 3D scene (a pill + a short label),
// constant on-screen size (CSS px) — the text counterpart of
// createIconSprite. The text and the colours can change afterwards
// (setText / setStyle: the canvas is redrawn, the sprite re-sized).
//
// The canvas is drawn at CANVAS_SCALE × the CSS size so it stays crisp on
// high-dpi screens.

const CANVAS_SCALE = 4;
const BORDER_PX = 1;
const PADDING_X_RATIO = 0.55; // of the CSS height
const FONT_RATIO = 0.46; // of the CSS height

// Returns { sprite, setText(text), setStyle({ color, background, border }),
// dispose() }.
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
  const padX = cssHeight * PADDING_X_RATIO * CANVAS_SCALE;
  const height = Math.ceil(cssHeight * CANVAS_SCALE);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const style = { color, background, border };
  let currentText = String(text ?? "");

  function draw() {
    // Resizing the canvas resets the context (font, alignment included).
    ctx.font = font;
    const width = Math.ceil(ctx.measureText(currentText).width + padX * 2);
    canvas.width = Math.max(2, width);
    canvas.height = Math.max(2, height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
      ctx.rect(
        inset,
        inset,
        canvas.width - inset * 2,
        canvas.height - inset * 2
      );
    }
    ctx.fillStyle = style.background;
    ctx.fill();
    ctx.lineWidth = BORDER_PX * CANVAS_SCALE;
    ctx.strokeStyle = style.border;
    ctx.stroke();

    // label
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = style.color;
    ctx.fillText(currentText, canvas.width / 2, canvas.height / 2);
  }

  draw();

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
  function resize() {
    sizeSpriteInCssPx(sprite, {
      cssHeight,
      aspect: canvas.width / canvas.height,
      compensateParentScale,
    });
  }
  resize();

  function redraw() {
    draw();
    texture.needsUpdate = true;
    resize();
  }

  return {
    sprite,
    setText: (nextText) => {
      const value = String(nextText ?? "");
      if (value === currentText) return;
      currentText = value;
      redraw();
    },
    setStyle: (nextStyle) => {
      const next = { ...style, ...nextStyle };
      if (
        next.color === style.color &&
        next.background === style.background &&
        next.border === style.border
      )
        return;
      Object.assign(style, next);
      redraw();
    },
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };
}
