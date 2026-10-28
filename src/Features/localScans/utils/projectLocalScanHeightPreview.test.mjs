import assert from "node:assert/strict";
import test from "node:test";
import projectHeight from "./projectLocalScanHeightPreview.js";

// identity frame: u = x, v = y, vertical = z
const frame = {
  rows: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  min: [0, 0, 0],
  max: [4, 4, 3],
};
const raster = { width: 4, height: 4, pixelSize: 1 };

test("the highest point of the range wins per pixel", () => {
  const positions = new Float32Array([
    1.5, 1.5, 0.2, 1.5, 1.5, 0.9, 1.5, 1.5, 2.8, 3.5, 0.5, 1.1, 9, 9, 1,
  ]);
  const all = projectHeight({ positions }, { frame, raster, fillPasses: 0 });
  assert.equal(all.count, 2);
  assert.ok(Math.abs(all.heights[1 * 4 + 1] - 2.8) < 1e-6);
  assert.ok(Number.isNaN(all.heights[0]));
  const sliced = projectHeight(
    { positions },
    { frame, raster, range: [-Infinity, 1.5], fillPasses: 0 }
  );
  assert.ok(Math.abs(sliced.heights[1 * 4 + 1] - 0.9) < 1e-6);
  assert.ok(Math.abs(sliced.heights[0 * 4 + 3] - 1.1) < 1e-6);
  assert.ok(Math.abs(sliced.min - 0.2) < 1e-6);
  assert.ok(Math.abs(sliced.max - 1.1) < 1e-6);
});
