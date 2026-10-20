import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

// Longest side of a preview texture, in px: readable on the table of the
// 3D base maps grid, a few MB on the GPU whatever the size of the plan
// (a full-resolution plan can weigh tens of MB).
export const PREVIEW_TEXTURE_MAX_SIZE = 1024;

// Down-scaled texture of a base map image: the image is decoded once,
// drawn into a canvas no larger than `maxSize` on its longest side and
// released — only the small canvas texture stays in memory. Rejects like
// getTextureAsync on a missing / failing url.
export default function getPreviewTextureAsync(
  url,
  { maxSize = PREVIEW_TEXTURE_MAX_SIZE } = {}
) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("getPreviewTextureAsync: missing texture url"));
      return;
    }
    const img = new Image();
    // blob / data urls do not care; a remote url needs it for the canvas
    // not to be tainted
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      if (!w || !h) {
        reject(new Error("getPreviewTextureAsync: empty image"));
        return;
      }
      const scale = Math.min(1, maxSize / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.needsUpdate = true;
      resolve(texture);
    };
    img.onerror = () =>
      reject(new Error(`getPreviewTextureAsync: failed to load ${url}`));
    img.src = url;
  });
}
