// Height map picture of the Prompt IA zip (`hauteurs.png`): heights above
// the base map plane, one pixel per pixel of `plan.png`, encoded on 16 bits
// in the R and G channels of an ordinary PNG (canvas PNGs are lossless as
// long as alpha stays 255).
//
//   v = R * 256 + G      0 = no surface, else h = (v - 1) / 65534 * zMax
//
// Pure module (node tests): no DOM, no alias imports.

export const RG16_MAX = 65534;

// h (metres, ≥ 0) → {r, g}; h === null → {r: 0, g: 0} (no surface).
export function encodeHeightRg16(h, zMax) {
  if (h === null || h === undefined || !Number.isFinite(h))
    return { r: 0, g: 0 };
  const ratio = zMax > 0 ? Math.min(1, Math.max(0, h / zMax)) : 0;
  const v = 1 + Math.round(ratio * RG16_MAX);
  return { r: v >> 8, g: v & 255 };
}

// {r, g} → metres, or null when the pixel holds no surface.
export function decodeHeightRg16(r, g, zMax) {
  const v = r * 256 + g;
  if (v === 0) return null;
  return ((v - 1) / RG16_MAX) * zMax;
}

/**
 * Pixels of the encoded picture and of its 8-bit grey preview.
 *
 * sampleAt(x, y) → height in metres (≥ 0) at the CENTRE of the output pixel
 * (x, y in output px), or null when there is no surface there. Two passes:
 * the range first (zMax = highest sampled value), then the encoding.
 *
 * Preview: black = 0 / no surface, white = zMax.
 *
 * @returns {{rgba: Uint8ClampedArray, preview: Uint8ClampedArray,
 *   stats: {zMax: number, coverage: number}}}
 */
export function buildHeightMapImageData({ width, height, sampleAt }) {
  const count = width * height;
  const samples = new Float32Array(count);
  const filled = new Uint8Array(count);
  let zMax = 0;
  let covered = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const h = sampleAt(x + 0.5, y + 0.5);
      if (h === null || h === undefined || !Number.isFinite(h)) continue;
      const i = y * width + x;
      const value = Math.max(0, h);
      samples[i] = value;
      filled[i] = 1;
      covered += 1;
      if (value > zMax) zMax = value;
    }
  }

  const rgba = new Uint8ClampedArray(count * 4);
  const preview = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    rgba[o + 3] = 255;
    preview[o + 3] = 255;
    if (!filled[i]) continue;
    const { r, g } = encodeHeightRg16(samples[i], zMax);
    rgba[o] = r;
    rgba[o + 1] = g;
    const grey = zMax > 0 ? Math.round((samples[i] / zMax) * 255) : 0;
    preview[o] = grey;
    preview[o + 1] = grey;
    preview[o + 2] = grey;
  }

  return {
    rgba,
    preview,
    stats: {
      zMax: Math.round(zMax * 1000) / 1000,
      coverage: count > 0 ? Math.round((covered / count) * 1000) / 1000 : 0,
    },
  };
}
