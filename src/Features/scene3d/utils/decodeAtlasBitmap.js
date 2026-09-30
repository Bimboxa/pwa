// Decodes one texture atlas at the size a bake needs (never the full 8192²
// on the GPU). The full-size decode is transient and closed right away;
// atlases are processed one at a time by the callers.
export default async function decodeAtlasBitmap(file, maxSize) {
  const full = await createImageBitmap(file, {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });
  const scale = Math.min(1, maxSize / Math.max(full.width, full.height));
  if (scale === 1) return full;
  try {
    return await createImageBitmap(full, {
      resizeWidth: Math.max(1, Math.round(full.width * scale)),
      resizeHeight: Math.max(1, Math.round(full.height * scale)),
      resizeQuality: "high",
      premultiplyAlpha: "none",
      colorSpaceConversion: "none",
    });
  } finally {
    full.close();
  }
}
