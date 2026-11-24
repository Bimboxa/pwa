import { mat3Invert } from "Features/photoPlans/utils/mat3";

// Warp a unit orthophoto onto its 4 corners when they do not form a
// parallelogram (getOrthophotoPlacement kind "PROJECTIVE"). Browser-only
// (canvas). Per-pixel inverse mapping with bilinear sampling, alpha kept —
// same technique as photoPlans/utils/bakePhotoPlanOrtho.
//
// `H` maps the unit square of the image onto the base map px, `bbox` is the
// corners' bounding box in base map px. Returns
//   { blob, x, y, width, height } — an image to draw at that base map rect,
// or null.

const MAX_OUT_DIM_PX = 3072;
const MAX_SRC_DIM_PX = 4096;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("orthophoto load failed"));
    img.src = url;
  });
}

export default async function bakeOrthophotoWarp({
  imageUrl,
  imageSize,
  H,
  bbox,
}) {
  if (!imageUrl || !H || !(bbox?.width > 0) || !(bbox?.height > 0)) {
    return null;
  }
  const Hinv = mat3Invert(H);
  if (!Hinv) return null;

  // Source pixels (downscaled when huge).
  const img = await loadImage(imageUrl);
  const natW = imageSize?.width || img.naturalWidth;
  const natH = imageSize?.height || img.naturalHeight;
  if (!natW || !natH) return null;
  const srcScale = Math.min(1, MAX_SRC_DIM_PX / Math.max(natW, natH));
  const W0 = Math.max(2, Math.round(natW * srcScale));
  const H0 = Math.max(2, Math.round(natH * srcScale));
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = W0;
  srcCanvas.height = H0;
  const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
  srcCtx.drawImage(img, 0, 0, W0, H0);
  const src = srcCtx.getImageData(0, 0, W0, H0).data;

  // Output resolution: the source density, capped.
  const density = Math.max(W0 / bbox.width, H0 / bbox.height);
  const s = Math.min(
    density,
    MAX_OUT_DIM_PX / Math.max(bbox.width, bbox.height)
  );
  const outW = Math.max(2, Math.round(bbox.width * s));
  const outH = Math.max(2, Math.round(bbox.height * s));

  const out = new ImageData(outW, outH);
  const dst = out.data;
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = Hinv;
  for (let row = 0; row < outH; row++) {
    const y = bbox.y + (row + 0.5) / s;
    for (let col = 0; col < outW; col++) {
      const x = bbox.x + (col + 0.5) / s;
      const w = h6 * x + h7 * y + h8;
      if (Math.abs(w) < 1e-12) continue;
      const u = (h0 * x + h1 * y + h2) / w;
      const v = (h3 * x + h4 * y + h5) / w;
      if (u < 0 || v < 0 || u > 1 || v > 1) continue;
      const sx = Math.min(Math.max(u * W0 - 0.5, 0), W0 - 1.001);
      const sy = Math.min(Math.max(v * H0 - 0.5, 0), H0 - 1.001);
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = 4 * (y0 * W0 + x0);
      const i10 = i00 + 4;
      const i01 = i00 + 4 * W0;
      const i11 = i01 + 4;
      const di = 4 * (row * outW + col);
      for (let ch = 0; ch < 4; ch++) {
        dst[di + ch] =
          src[i00 + ch] * (1 - fx) * (1 - fy) +
          src[i10 + ch] * fx * (1 - fy) +
          src[i01 + ch] * (1 - fx) * fy +
          src[i11 + ch] * fx * fy;
      }
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  canvas.getContext("2d").putImageData(out, 0, 0);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) return null;

  return {
    blob,
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
  };
}
