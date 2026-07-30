import {
  CanvasTexture,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from "three";

import sizeSpriteInCssPx from "./sizeSpriteInCssPx";

// Small fixed-screen-size anchor marker at the pointed end of a label leader
// (black disc + white ring, matching the black leader line and the 2D dot).
// Rotation-invariant (billboard sprite), sized in CSS px like its 2D
// counterpart, depth-aware like the card and the leader, never raycast (the
// drag grip is the bigger target handle shown on the selected annotation).

// Diameter in CSS px — the 2D dot is r=2 px plus its white stroke.
const ANCHOR_CSS_PX = 5;
const CANVAS_PX = 64;

export default function createAnnotationLabelAnchorSprite({ annotationId }) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext("2d");
  const c = CANVAS_PX / 2;

  ctx.beginPath();
  ctx.arc(c, c, c - 6, 0, Math.PI * 2);
  ctx.fillStyle = "#000000";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: false,
    toneMapped: false,
  });

  const sprite = new Sprite(material);
  sizeSpriteInCssPx(sprite, { cssHeight: ANCHOR_CSS_PX, aspect: 1 });
  sprite.renderOrder = 1002;
  // Pure marker: never picked (the target handle is the grab surface).
  sprite.raycast = () => {};
  sprite.userData = {
    annotationId,
    isAnnotationLabelAnchor: true,
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };

  return sprite;
}
