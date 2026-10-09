import {
  CanvasTexture,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from "three";

// Text sprite drawn in the 3D scene (a sheet name, the "new base map"
// caption): a canvas texture on a size-attenuated sprite — the caller sets
// the scale from `aspect`, in the local metres of its parent.
//
// Returns { sprite, aspect, dispose() }.

const LABEL_FONT_PX = 96;
const LABEL_COLOR = "#424242";

export default function createLabelSprite(text) {
  const font = `600 ${LABEL_FONT_PX}px sans-serif`;
  const measureCtx = document.createElement("canvas").getContext("2d");
  measureCtx.font = font;
  const pad = LABEL_FONT_PX * 0.3;
  const width = Math.ceil(measureCtx.measureText(text).width + pad * 2);
  const height = Math.ceil(LABEL_FONT_PX * 1.3 + pad);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, width);
  canvas.height = Math.max(2, height);
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = LABEL_COLOR;
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
    sizeAttenuation: true,
    toneMapped: false,
  });
  const sprite = new Sprite(material);

  return {
    sprite,
    aspect: canvas.width / canvas.height,
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };
}
