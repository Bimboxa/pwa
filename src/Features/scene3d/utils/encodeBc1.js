// BC1 (S3TC DXT1, opaque) encoder: 4x4 pixel blocks → 8 bytes (two RGB565
// endpoints + sixteen 2-bit palette indices), i.e. 0.5 byte per pixel on the
// GPU instead of 4. Range-fit encoder: the endpoints are the corners of the
// block's RGB bounding box (slightly inset), each pixel takes the nearest of
// the 4 palette colors. Plenty for photogrammetry atlases.
//
// rgba: Uint8Array / Uint8ClampedArray (width * height * 4, first row = top).
// Returns a Uint8Array of ceil(width / 4) * ceil(height / 4) * 8 bytes.
// Pure module: runs in the import worker and in node tests.

function to565(r, g, b) {
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

export default function encodeBc1(rgba, width, height) {
  const blocksX = Math.max(1, Math.ceil(width / 4));
  const blocksY = Math.max(1, Math.ceil(height / 4));
  const out = new Uint8Array(blocksX * blocksY * 8);
  const block = new Uint8Array(48); // 16 pixels, rgb
  const palette = new Int32Array(12); // 4 colors, rgb

  let o = 0;
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let minR = 255;
      let minG = 255;
      let minB = 255;
      let maxR = 0;
      let maxG = 0;
      let maxB = 0;
      for (let py = 0; py < 4; py++) {
        // edge blocks of a level smaller than 4 px repeat the last pixel
        const y = Math.min(height - 1, by * 4 + py);
        for (let px = 0; px < 4; px++) {
          const x = Math.min(width - 1, bx * 4 + px);
          const s = (y * width + x) * 4;
          const d = (py * 4 + px) * 3;
          const r = rgba[s];
          const g = rgba[s + 1];
          const b = rgba[s + 2];
          block[d] = r;
          block[d + 1] = g;
          block[d + 2] = b;
          if (r < minR) minR = r;
          if (g < minG) minG = g;
          if (b < minB) minB = b;
          if (r > maxR) maxR = r;
          if (g > maxG) maxG = g;
          if (b > maxB) maxB = b;
        }
      }

      // inset the box: the 2 interpolated colors land closer to the pixels
      const insetR = (maxR - minR) >> 4;
      const insetG = (maxG - minG) >> 4;
      const insetB = (maxB - minB) >> 4;
      let c0 = to565(maxR - insetR, maxG - insetG, maxB - insetB);
      let c1 = to565(minR + insetR, minG + insetG, minB + insetB);

      let indices = 0;
      if (c0 !== c1) {
        // 4-color mode requires c0 > c1
        if (c0 < c1) {
          const swap = c0;
          c0 = c1;
          c1 = swap;
        }
        // endpoints as the GPU expands them (565 → 888)
        const r0 = ((c0 >> 11) * 527 + 23) >> 6;
        const g0 = (((c0 >> 5) & 63) * 259 + 33) >> 6;
        const b0 = ((c0 & 31) * 527 + 23) >> 6;
        const r1 = ((c1 >> 11) * 527 + 23) >> 6;
        const g1 = (((c1 >> 5) & 63) * 259 + 33) >> 6;
        const b1 = ((c1 & 31) * 527 + 23) >> 6;
        palette[0] = r0;
        palette[1] = g0;
        palette[2] = b0;
        palette[3] = r1;
        palette[4] = g1;
        palette[5] = b1;
        palette[6] = (2 * r0 + r1) / 3;
        palette[7] = (2 * g0 + g1) / 3;
        palette[8] = (2 * b0 + b1) / 3;
        palette[9] = (r0 + 2 * r1) / 3;
        palette[10] = (g0 + 2 * g1) / 3;
        palette[11] = (b0 + 2 * b1) / 3;

        for (let i = 15; i >= 0; i--) {
          const r = block[i * 3];
          const g = block[i * 3 + 1];
          const b = block[i * 3 + 2];
          let best = 0;
          let bestDistance = Infinity;
          for (let c = 0; c < 4; c++) {
            const dr = r - palette[c * 3];
            const dg = g - palette[c * 3 + 1];
            const db = b - palette[c * 3 + 2];
            const distance = dr * dr + dg * dg + db * db;
            if (distance < bestDistance) {
              bestDistance = distance;
              best = c;
            }
          }
          indices = (indices << 2) | best;
        }
      }

      out[o++] = c0 & 255;
      out[o++] = c0 >> 8;
      out[o++] = c1 & 255;
      out[o++] = c1 >> 8;
      out[o++] = indices & 255;
      out[o++] = (indices >>> 8) & 255;
      out[o++] = (indices >>> 16) & 255;
      out[o++] = (indices >>> 24) & 255;
    }
  }
  return out;
}
