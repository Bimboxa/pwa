import {
  CanvasTexture,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from "three";

import sizeSpriteInCssPx from "Features/threedAnnotationLabels/services/sizeSpriteInCssPx";

// Same blue as the 2D cut axis (NodeRevolutionAxisStatic).
const BLUE = "#1976d2";
const HANDLE_CSS_PX = 12;
const CANVAS_PX = 64;

// White disc with a blue ring + blue dot: the handle of a revolution axis in
// the 3D editor (cut-axis rotation — ThreedRevolutionAxisHandles; altitude of
// the horizontal cut — ThreedRevolutionAxisHorizontalCuts), the 3D
// counterpart of the 2D rotation handle. Screen-constant
// (sizeSpriteInCssPx), always on top.
export default function createRevolutionAxisHandleSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext("2d");
  const c = CANVAS_PX / 2;
  ctx.beginPath();
  ctx.arc(c, c, c - 6, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = BLUE;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, c / 5, 0, Math.PI * 2);
  ctx.fillStyle = BLUE;
  ctx.fill();

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
  });
  const sprite = new Sprite(material);
  sizeSpriteInCssPx(sprite, { cssHeight: HANDLE_CSS_PX });
  sprite.renderOrder = 1005;
  sprite.userData.dispose = () => {
    texture.dispose();
    material.dispose();
  };
  return sprite;
}
