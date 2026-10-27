import test from "node:test";
import assert from "node:assert/strict";
import getUsefulScanHeight from "./getUsefulScanHeight.js";

test("isolated low and high points do not stretch the useful slider domain", () => {
  const positions = new Float32Array(30000);
  for (let i = 0; i < 10000; i++) positions[i * 3 + 2] = ((i % 100) / 100) * 3;
  for (let i = 0; i < 10; i++) positions[i * 3 + 2] = -50;
  for (let i = 10; i < 20; i++) positions[i * 3 + 2] = 50;
  const before = positions.slice();
  const domain = getUsefulScanHeight(positions, [0, 0, 1, 0], {
    min: -50,
    max: 50,
  });
  assert.ok(domain.min >= 0 && domain.max <= 3);
  assert.deepEqual(positions, before);
});

test("height bounds respect the selected vertical axis, scale and origin", () => {
  const positions = new Float32Array(3000);
  for (let i = 0; i < 1000; i++) {
    positions[i * 3 + 1] = i / 100;
    positions[i * 3 + 2] = -1000;
  }
  const domain = getUsefulScanHeight(positions, [0, -2, 0, 4], {
    min: -16,
    max: 4,
  });
  assert.ok(Math.abs(domain.min - -15.8) < 0.03);
  assert.ok(Math.abs(domain.max - 3.82) < 0.03);
});

test("small clouds keep exact bounds and flat scans stay finite", () => {
  const fallback = { min: 1, max: 2 };
  assert.equal(
    getUsefulScanHeight(new Float32Array(9), [0, 0, 1, 0], fallback),
    fallback
  );
  assert.deepEqual(
    getUsefulScanHeight(new Float32Array(3000), [0, 0, 1, 2], fallback),
    { min: 2, max: 2 }
  );
});
