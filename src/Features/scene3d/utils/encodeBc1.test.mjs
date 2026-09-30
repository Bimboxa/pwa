import assert from "node:assert/strict";
import { test } from "node:test";

import encodeBc1 from "./encodeBc1.js";
import decodeBc1 from "./decodeBc1.js";

function fill(width, height, fn) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fn(x, y);
      rgba.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return rgba;
}

function maxError(a, b) {
  let max = 0;
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
  return max;
}

test("output size is 8 bytes per 4x4 block", () => {
  assert.equal(
    encodeBc1(
      fill(8, 4, () => [0, 0, 0]),
      8,
      4
    ).length,
    16
  );
  assert.equal(
    encodeBc1(
      fill(2, 1, () => [0, 0, 0]),
      2,
      1
    ).length,
    8
  );
});

test("a flat color survives the round trip (565 precision)", () => {
  const rgba = fill(4, 4, () => [200, 100, 50]);
  const decoded = decodeBc1(encodeBc1(rgba, 4, 4), 4, 4);
  assert.ok(maxError(rgba, decoded) <= 8);
});

test("a two-color block keeps both colors at their pixels", () => {
  const rgba = fill(4, 4, (x) => (x < 2 ? [255, 255, 255] : [0, 0, 0]));
  const decoded = decodeBc1(encodeBc1(rgba, 4, 4), 4, 4);
  // inset endpoints: within 1/16 of the range + 565 rounding
  assert.ok(maxError(rgba, decoded) <= 24);
  assert.ok(decoded[0] > 200 && decoded[3 * 4] < 50);
});

test("a smooth gradient stays close", () => {
  const rgba = fill(16, 16, (x, y) => [x * 16, y * 16, 128]);
  const decoded = decodeBc1(encodeBc1(rgba, 16, 16), 16, 16);
  assert.ok(maxError(rgba, decoded) <= 40);
});

test("levels smaller than a block decode to their own size", () => {
  const rgba = fill(2, 2, () => [10, 200, 90]);
  const decoded = decodeBc1(encodeBc1(rgba, 2, 2), 2, 2);
  assert.equal(decoded.length, 16);
  assert.ok(maxError(rgba, decoded) <= 8);
});
