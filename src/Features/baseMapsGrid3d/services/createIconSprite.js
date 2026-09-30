import {
  CanvasTexture,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from "three";

import sizeSpriteInCssPx from "Features/threedAnnotationLabels/services/sizeSpriteInCssPx";

// Round icon button drawn in the 3D scene: white disc + a Material icon,
// constant on-screen size (CSS px), whatever the scale of its parent group.
//
// The icons are the 24×24 path data of `@mui/icons-material` (Visibility /
// VisibilityOff), drawn with Path2D — synchronous, no SVG image round trip.
export const ICON_PATHS = {
  VISIBILITY:
    "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5M12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5m0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3",
  VISIBILITY_OFF:
    "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7M2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2m4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3z",
};

const CANVAS_PX = 128;
const ICON_VIEWBOX = 24;
// share of the disc diameter covered by the icon
const ICON_RATIO = 0.62;

function drawIcon(ctx, iconPath, { color, background, border }) {
  const c = CANVAS_PX / 2;
  ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);

  ctx.beginPath();
  ctx.arc(c, c, c - 4, 0, Math.PI * 2);
  ctx.fillStyle = background;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = border;
  ctx.stroke();

  const size = CANVAS_PX * ICON_RATIO;
  const k = size / ICON_VIEWBOX;
  ctx.save();
  ctx.translate(c - size / 2, c - size / 2);
  ctx.scale(k, k);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(iconPath));
  ctx.restore();
}

// Returns { sprite, setIcon(iconPath), dispose() }.
export default function createIconSprite({
  iconPath,
  cssSize = 28,
  color = "#424242",
  background = "#ffffff",
  border = "rgba(0,0,0,0.25)",
}) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext("2d");
  const style = { color, background, border };
  drawIcon(ctx, iconPath, style);

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
    cssHeight: cssSize,
    aspect: 1,
    compensateParentScale: true,
  });

  let currentPath = iconPath;

  return {
    sprite,
    setIcon: (nextPath) => {
      if (nextPath === currentPath) return;
      currentPath = nextPath;
      drawIcon(ctx, nextPath, style);
      texture.needsUpdate = true;
    },
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };
}
