// BC1 (S3TC DXT1) → RGBA. Used as the fallback of the SCENE_3D textures on
// GPUs without the S3TC extension (the stored format is always BC1), and by
// the encoder tests.
//
// data: Uint8Array of ceil(width / 4) * ceil(height / 4) * 8 bytes.
// Returns a Uint8Array (width * height * 4, first row = top).

export default function decodeBc1(data, width, height) {
  const blocksX = Math.max(1, Math.ceil(width / 4));
  const blocksY = Math.max(1, Math.ceil(height / 4));
  const out = new Uint8Array(width * height * 4);
  const palette = new Uint8Array(16);

  let s = 0;
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const c0 = data[s] | (data[s + 1] << 8);
      const c1 = data[s + 2] | (data[s + 3] << 8);
      const indices =
        (data[s + 4] |
          (data[s + 5] << 8) |
          (data[s + 6] << 16) |
          (data[s + 7] << 24)) >>>
        0;
      s += 8;

      palette[0] = ((c0 >> 11) * 527 + 23) >> 6;
      palette[1] = (((c0 >> 5) & 63) * 259 + 33) >> 6;
      palette[2] = ((c0 & 31) * 527 + 23) >> 6;
      palette[4] = ((c1 >> 11) * 527 + 23) >> 6;
      palette[5] = (((c1 >> 5) & 63) * 259 + 33) >> 6;
      palette[6] = ((c1 & 31) * 527 + 23) >> 6;
      if (c0 > c1) {
        for (let k = 0; k < 3; k++) {
          palette[8 + k] = (2 * palette[k] + palette[4 + k]) / 3;
          palette[12 + k] = (palette[k] + 2 * palette[4 + k]) / 3;
        }
      } else {
        // 3-color mode (never produced by encodeBc1): midpoint + black
        for (let k = 0; k < 3; k++) {
          palette[8 + k] = (palette[k] + palette[4 + k]) / 2;
          palette[12 + k] = 0;
        }
      }

      for (let py = 0; py < 4; py++) {
        const y = by * 4 + py;
        if (y >= height) break;
        for (let px = 0; px < 4; px++) {
          const x = bx * 4 + px;
          if (x >= width) continue;
          const c = (indices >>> ((py * 4 + px) * 2)) & 3;
          const d = (y * width + x) * 4;
          out[d] = palette[c * 4];
          out[d + 1] = palette[c * 4 + 1];
          out[d + 2] = palette[c * 4 + 2];
          out[d + 3] = 255;
        }
      }
    }
  }
  return out;
}
