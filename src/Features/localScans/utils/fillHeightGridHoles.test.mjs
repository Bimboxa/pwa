import assert from "node:assert/strict";
import test from "node:test";
import fill from "./fillHeightGridHoles.js";

test("small gaps close, wide holes stay (Uint16, 0 = empty)", () => {
  const cols = 9,
    rows = 1;
  // two filled cells 2 apart, then a wide gap
  const data = new Uint16Array([100, 0, 200, 0, 0, 0, 0, 0, 0]);
  fill(data, cols, rows, 1);
  assert.equal(data[1], 150);
  // a single neighbour is not enough to extend the sheet
  assert.equal(data[3], 0);
  assert.equal(data[8], 0);
});

test("Float32 previews use NaN as empty", () => {
  const data = new Float32Array([1, NaN, 3, NaN, NaN, NaN, NaN]);
  fill(data, 7, 1, 2);
  assert.ok(Math.abs(data[1] - 2) < 1e-6);
  assert.ok(Number.isNaN(data[6]));
});

test("a 2D gap fills from every side", () => {
  const cols = 3,
    rows = 3;
  const data = new Uint16Array([10, 10, 10, 10, 0, 10, 10, 10, 10]);
  fill(data, cols, rows);
  assert.equal(data[4], 10);
});
