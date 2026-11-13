import {
  CanvasTexture,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from "three";

import sizeSpriteInCssPx from "./sizeSpriteInCssPx";

// Numbered badge of a photo anchor off in situ + "Numéro" (the 3D
// counterpart of ImageIndexBadgeSvg): dark rounded rectangle, white ring,
// bold number, constant CSS size, always on top, never raycast. Centred on
// the anchor: it replaces the anchor dot.

const BADGE_CSS_HEIGHT_PX = 20;
const BADGE_ASPECT = 1.3;
const CANVAS_H = 128;
const CANVAS_W = Math.round(CANVAS_H * BADGE_ASPECT);

export default function createAnnotationNumberBadgeSprite({
  annotationId,
  number,
  dimmed = false,
}) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  const inset = 8;
  const w = CANVAS_W - 2 * inset;
  const h = CANVAS_H - 2 * inset;
  const r = h * 0.3;

  ctx.beginPath();
  ctx.moveTo(inset + r, inset);
  ctx.arcTo(inset + w, inset, inset + w, inset + h, r);
  ctx.arcTo(inset + w, inset + h, inset, inset + h, r);
  ctx.arcTo(inset, inset + h, inset, inset, r);
  ctx.arcTo(inset, inset, inset + w, inset, r);
  ctx.closePath();
  ctx.fillStyle = "#333333";
  ctx.fill();
  ctx.lineWidth = 9;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${Math.round(CANVAS_H * 0.5)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number ?? ""), CANVAS_W / 2, CANVAS_H / 2 + 4);

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
    opacity: dimmed ? 0.3 : 1,
  });

  const sprite = new Sprite(material);
  sizeSpriteInCssPx(sprite, {
    cssHeight: BADGE_CSS_HEIGHT_PX,
    aspect: BADGE_ASPECT,
  });
  sprite.renderOrder = 1004;
  sprite.raycast = () => {};
  sprite.userData = {
    annotationId,
    isImageNumberBadge: true,
    noVertexSnap: true,
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };

  return sprite;
}
