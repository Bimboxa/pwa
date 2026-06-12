import {
  CanvasTexture,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  LinearFilter,
} from "three";
import { darken, lighten } from "@mui/material/styles";

import { polygonCentroid } from "Features/mesh/utils/meshGeometry";
import shadeMeshCellColor from "Features/mesh/utils/meshCellColor";

import pixelToWorld from "./pixelToWorld";

// Small lift (basemap-local Z, becomes world Y after the group rotation) so the
// card floats just above its cell surface instead of z-fighting with it.
const LABEL_LIFT_M = 0.05;

// On-screen card height as a fraction of the viewport height (sizeAttenuation
// is off, so the sprite keeps a constant size regardless of camera distance).
const CARD_SCREEN_HEIGHT = 0.048;

// Supersampling factor for crisp canvas text at high DPI.
const CANVAS_SCALE = 4;

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// Rounded-rect path helper for the card background/border.
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Build a camera-facing card sprite showing the mesh cell name (M1, M2…).
// Returns null when there's nothing to display.
export default function createMeshCellLabelSprite(annotation, baseMap) {
  if (!annotation) return null;

  const label = annotation.label || "";
  if (!label) return null;

  // colors derived from the cell's annotation color, shaded per cell (by
  // reading-order index) so adjacent cards match their mesh and differ from
  // their neighbours.
  const rawBase = annotation.fillColor || annotation.strokeColor || "#1976d2";
  const base = shadeMeshCellColor(rawBase, annotation.label);
  const borderColor = safe(() => darken(base, 0.4), base);
  const fillBg = safe(() => lighten(base, 0.7), base);
  const textColor = safe(() => darken(base, 0.4), base);

  // --- measure ---
  const s = CANVAS_SCALE;
  const titleFontPx = 26 * s;
  const padX = 16 * s;
  const padY = 12 * s;
  const lineGap = 6 * s;
  const radius = 10 * s;
  const borderWidth = 3 * s;

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  const lines = [
    { text: label, font: `bold ${titleFontPx}px sans-serif`, h: titleFontPx },
  ];

  let maxTextW = 0;
  lines.forEach((ln) => {
    mctx.font = ln.font;
    maxTextW = Math.max(maxTextW, mctx.measureText(ln.text).width);
  });

  const contentH =
    lines.reduce((acc, ln) => acc + ln.h, 0) + lineGap * (lines.length - 1);
  const canvasW = Math.ceil(maxTextW + padX * 2);
  const canvasH = Math.ceil(contentH + padY * 2);

  // --- draw ---
  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");

  const inset = borderWidth / 2;
  roundRect(ctx, inset, inset, canvasW - borderWidth, canvasH - borderWidth, radius);
  ctx.fillStyle = fillBg;
  ctx.fill();
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  let y = padY;
  lines.forEach((ln) => {
    ctx.font = ln.font;
    ctx.fillText(ln.text, canvasW / 2, y);
    y += ln.h + lineGap;
  });

  // --- texture + sprite ---
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    // depthTest off → the card is never clipped by the 3D annotation geometry
    // (e.g. sliced in two by the wall it labels). It still belongs to the
    // transparent pass, so three.js keeps sorting the cards back-to-front among
    // themselves (painter's order) → card-to-card depth stays correct.
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
  });

  const sprite = new Sprite(material);

  // Constant on-screen size: scale.y = card screen-height fraction, scale.x
  // keeps the canvas aspect ratio.
  const aspect = canvasW / canvasH;
  sprite.scale.set(CARD_SCREEN_HEIGHT * aspect, CARD_SCREEN_HEIGHT, 1);

  // Horizontal placement: the cell footprint centroid (plan space).
  const centroid = polygonCentroid(annotation.points);
  const local = pixelToWorld(centroid, baseMap);

  // Vertical placement: center on THIS cell's own band, not the parent wall.
  // A wall cell carries per-point offsetBottom / offsetTop, so its vertical
  // span at a point is [offsetZ + offsetBottom, offsetZ + height + offsetTop]
  // (Z_bottom = offsetBottom, Z_top = height + offsetTop — same model as
  // extrudePolylineWall / computeWallQty). The band mid is therefore
  // offsetZ + height/2 + mean((offsetBottom + offsetTop) / 2). Without this,
  // two cells stacked into separate height bands (e.g. M3 above M4) would both
  // sit at the parent's mid-height. Flat cells (height 0, no offsets) keep the
  // small lift so the card hovers just above the surface.
  const height = Number(annotation.height) || 0;
  const pts = annotation.points || [];
  let bandMid = 0;
  if (pts.length > 0) {
    let sum = 0;
    for (const p of pts) sum += ((p.offsetBottom ?? 0) + (p.offsetTop ?? 0)) / 2;
    bandMid = sum / pts.length;
  }
  const z =
    (Number(annotation.offsetZ) || 0) +
    height / 2 +
    bandMid +
    (height > 0 ? 0 : LABEL_LIFT_M);
  sprite.position.set(local.x, local.y, z);

  // Never intercept hover/click picking.
  sprite.raycast = () => {};
  sprite.userData = {
    isMeshCellLabel: true,
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };

  return sprite;
}
