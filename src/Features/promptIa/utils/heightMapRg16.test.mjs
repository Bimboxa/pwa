import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RG16_MAX,
  buildHeightMapImageData,
  decodeHeightRg16,
  encodeHeightRg16,
} from "./heightMapRg16.js";

test("encode / decode round trip within one quantization step", () => {
  const zMax = 12.345;
  for (const h of [0, 0.001, 1.5, 7.77, zMax]) {
    const { r, g } = encodeHeightRg16(h, zMax);
    assert.ok(r >= 0 && r <= 255 && g >= 0 && g <= 255);
    const back = decodeHeightRg16(r, g, zMax);
    assert.ok(Math.abs(back - h) <= zMax / RG16_MAX + 1e-9, `h=${h}`);
  }
  // The zero height is not the "no surface" pixel.
  assert.deepEqual(encodeHeightRg16(0, zMax), { r: 0, g: 1 });
  assert.equal(decodeHeightRg16(0, 1, zMax), 0);
});

test("no surface ↔ (0, 0)", () => {
  assert.deepEqual(encodeHeightRg16(null, 3), { r: 0, g: 0 });
  assert.deepEqual(encodeHeightRg16(NaN, 3), { r: 0, g: 0 });
  assert.equal(decodeHeightRg16(0, 0, 3), null);
});

test("buildHeightMapImageData: ramp 0 → 3 m, one empty pixel", () => {
  const width = 4;
  const height = 2;
  // height grows with x: 0, 1, 2, 3 m; pixel (0, 1) has no surface
  const sampleAt = (x, y) => (x < 1 && y > 1 ? null : Math.floor(x));
  const { rgba, preview, stats } = buildHeightMapImageData({
    width,
    height,
    sampleAt,
  });
  assert.equal(stats.zMax, 3);
  assert.equal(stats.coverage, 7 / 8);

  const at = (x, y) => {
    const o = (y * width + x) * 4;
    return {
      r: rgba[o],
      g: rgba[o + 1],
      a: rgba[o + 3],
      grey: preview[o],
      pa: preview[o + 3],
    };
  };
  // empty pixel: (0,0) encoded, black preview, opaque
  assert.deepEqual(at(0, 1), { r: 0, g: 0, a: 255, grey: 0, pa: 255 });
  // monotonic values along the ramp
  const values = [0, 1, 2, 3].map((x) => {
    const { r, g } = at(x, 0);
    return decodeHeightRg16(r, g, stats.zMax);
  });
  values.forEach((v, x) =>
    assert.ok(Math.abs(v - x) <= stats.zMax / RG16_MAX + 1e-9, `x=${x}`)
  );
  assert.equal(at(3, 0).grey, 255);
  assert.equal(at(0, 0).grey, 0);
  assert.ok(at(1, 0).grey < at(2, 0).grey);
});
