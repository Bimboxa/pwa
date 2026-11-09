import {
  CanvasTexture,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from "three";

import sizeSpriteInCssPx from "./sizeSpriteInCssPx";

// Numbered badge of a photo anchor in ex situ + "Numéro" link style (the 3D
// counterpart of ImageIndexBadgeSvg): dark disc, white ring, bold number,
// constant CSS size, always on top, never raycast. Sits just above the
// anchor dot (sprite center shifted down).

const BADGE_CSS_PX = 20;
const CANVAS_PX = 128;

export default function createAnnotationNumberBadgeSprite({
  annotationId,
  number,
  dimmed = false,
}) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext("2d");
  const c = CANVAS_PX / 2;

  ctx.beginPath();
  ctx.arc(c, c, c - 8, 0, Math.PI * 2);
  ctx.fillStyle = "#333333";
  ctx.fill();
  ctx.lineWidth = 9;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${Math.round(CANVAS_PX * 0.5)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number ?? ""), c, c + 4);

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
  sizeSpriteInCssPx(sprite, { cssHeight: BADGE_CSS_PX, aspect: 1 });
  // Above the anchor dot: the sprite's center is pushed below its bottom edge.
  sprite.center.set(0.5, -0.35);
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
