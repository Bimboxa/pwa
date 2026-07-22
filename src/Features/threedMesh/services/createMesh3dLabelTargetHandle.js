import {
  CanvasTexture,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from "three";

import { DEFAULT_MESH3D_COLOR } from "../utils/mesh3dConstants";

// Constant on-screen size (sizeAttenuation: false), like the label card.
const HANDLE_SCREEN_SIZE = 0.022;
const CANVAS_PX = 64;

/**
 * Grab handle at the pointed end of a maille label leader. Shown on the
 * selected maille only; dragging it moves the leader's target within the
 * maille plane (persisted as `mesh3d.labelTargetOffset`).
 */
export default function createMesh3dLabelTargetHandle({
  mesh3dId,
  color = DEFAULT_MESH3D_COLOR,
}) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext("2d");
  const c = CANVAS_PX / 2;

  ctx.beginPath();
  ctx.arc(c, c, c - 8, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(c, c, c / 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
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
  sprite.scale.set(HANDLE_SCREEN_SIZE, HANDLE_SCREEN_SIZE, 1);
  sprite.renderOrder = 1004;
  sprite.userData = {
    mesh3dId,
    isMesh3dLabelTargetHandle: true,
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };

  return sprite;
}
