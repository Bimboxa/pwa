import assert from "node:assert/strict";
import test from "node:test";
import pickNearestScanPointOnScreen from "./pickNearestScanPointOnScreen.js";

// Orthographic view down -Z over [-10, 10]², depth range z ∈ [-100, 100]:
// ndc = (x / 10, y / 10, -z / 100); 1000 px canvas → 50 px per unit.
const matrix = [0.1, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, -0.01, 0, 0, 0, 0, 1];
const query = (overrides = {}) => ({
  matrix,
  ndc: [0, 0],
  width: 1000,
  height: 1000,
  origin: [0, 0, 100],
  direction: [0, 0, -1],
  ...overrides,
});

test("picks the point nearest to the camera within the pixel radius", () => {
  const positions = new Float32Array([
    0, 0, 0, 0.05, 0, 5, 0.5, 0, 50, 0, 0.1, 2,
  ]);
  const hit = pickNearestScanPointOnScreen(positions, query());
  // (0.5, 0, 50) is 25 px away: outside the 6 px radius
  assert.deepEqual(hit.point.map(Math.fround), [Math.fround(0.05), 0, 5]);
  assert.equal(hit.depth, 95);
});

test("returns null when no point is drawn under the cursor", () => {
  const positions = new Float32Array([5, 5, 0, -3, 2, 1]);
  assert.equal(pickNearestScanPointOnScreen(positions, query()), null);
  assert.equal(
    pickNearestScanPointOnScreen(new Float32Array(0), query()),
    null
  );
});

test("ignores points behind the ray origin or outside the depth range", () => {
  const positions = new Float32Array([0, 0, 150, 0, 0, -150, 0, 0, -20]);
  const hit = pickNearestScanPointOnScreen(positions, query());
  assert.deepEqual(hit.point, [0, 0, -20]);
});

test("honours the height slice and the clipping planes", () => {
  const positions = new Float32Array([0, 0, 30, 0, 0, 10, 0, 0, -5]);
  const slice = { row: [0, 0, 1, 0], lower: -10, upper: 20 };
  assert.deepEqual(
    pickNearestScanPointOnScreen(positions, query({ slice })).point,
    [0, 0, 10]
  );
  // keeps z <= 0
  const planes = [[0, 0, -1, 0]];
  assert.deepEqual(
    pickNearestScanPointOnScreen(positions, query({ planes })).point,
    [0, 0, -5]
  );
});

test("reads one point out of `step` and widens with radiusPx", () => {
  const positions = new Float32Array([0, 0, 9, 0, 0, 5, 0.3, 0, 1]);
  assert.deepEqual(
    pickNearestScanPointOnScreen(positions, query({ step: 2 })).point.map(
      Math.fround
    ),
    [0, 0, 9].map(Math.fround)
  );
  assert.deepEqual(
    pickNearestScanPointOnScreen(positions, query({ radiusPx: 20 })).point,
    [0, 0, 9]
  );
});
