import assert from "node:assert/strict";
import test from "node:test";
import frame from "./frameProjectionRaster.js";
import prepare from "./prepareScanBaseMap.js";

const raster = (width, height) => {
  const density = new Uint8ClampedArray(width * height * 4).fill(255);
  return { width, height, pixelSize: 0.05, density, rgb: density.slice() };
};
const baseFrame = {
  min: [2, -3, 0],
  max: [2.4, -2.7, 1],
  xDirection: [1, 0, 0],
  yDirection: [0, 0, 1],
};
// World (u, v) of a pixel centre in a raster / frame pair.
const uv = (f, px, col, row) => [
  f.min[0] + (col + 0.5) * px,
  f.min[1] + (row + 0.5) * px,
];

test("a framing larger than the raster pads in white and keeps every point", () => {
  const result = raster(8, 6);
  result.density.fill(0, (2 * 8 + 3) * 4, (2 * 8 + 3) * 4 + 3);
  const { result: framed, frame: framedFrame } = frame(result, baseFrame, {
    x: -4.2,
    y: -1.9,
    width: 16,
    height: 11.3,
  });
  assert.equal(framed.width, 16);
  assert.equal(framed.height, 11);
  // Dark pixel (3, 2) moved by the rounded offset (4, 2).
  const index = (4 * 16 + 7) * 4;
  assert.equal(framed.density[index], 0);
  assert.equal(framed.density[0], 255);
  assert.deepEqual(
    uv(framedFrame, 0.05, 7, 4).map((v) => +v.toFixed(9)),
    uv(baseFrame, 0.05, 3, 2).map((v) => +v.toFixed(9))
  );
  // The base map centre is the framing centre.
  const { position } = prepare(framed, framedFrame);
  assert.ok(Math.abs(position.x - (2 + (-4 + 8) * 0.05)) < 1e-9);
  assert.ok(Math.abs(position.z - (-3 + (-2 + 5.5) * 0.05)) < 1e-9);
});

test("a framing inside the raster crops it", () => {
  const result = raster(10, 10);
  const { result: framed } = frame(result, baseFrame, {
    x: 2,
    y: 3,
    width: 4,
    height: 2,
  });
  assert.equal(framed.width * framed.height * 4, framed.rgb.length);
  assert.throws(() =>
    frame(result, baseFrame, { x: 0, y: 0, width: 6000, height: 6000 })
  );
});
