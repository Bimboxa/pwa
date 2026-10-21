import test from "node:test";
import assert from "node:assert/strict";

import computeAxesYawFromPoints from "./computeAxesYawFromPoints.js";

const O = { x: 1, y: 0.5, z: -2 };

test("target along world +X → 0°", () => {
  assert.equal(computeAxesYawFromPoints(O, { x: 4, y: 3, z: -2 }), 0);
});

test("target along world -Z (user +Y side) → 90°", () => {
  assert.equal(computeAxesYawFromPoints(O, { x: 1, y: 0, z: -5 }), 90);
});

test("target along world -X → 180°", () => {
  assert.equal(computeAxesYawFromPoints(O, { x: -2, y: 0, z: -2 }), 180);
});

test("target along world +Z → 270° (wrapped into [0, 360))", () => {
  assert.equal(computeAxesYawFromPoints(O, { x: 1, y: 0, z: 1 }), 270);
});

test("45° diagonal", () => {
  const yaw = computeAxesYawFromPoints(O, { x: 2, y: 0, z: -3 });
  assert.ok(Math.abs(yaw - 45) < 1e-9);
});

test("target on the origin (vertically above included) → null", () => {
  assert.equal(computeAxesYawFromPoints(O, { x: 1, y: 7, z: -2 }), null);
  assert.equal(computeAxesYawFromPoints(O, { x: 1.001, y: 0, z: -2 }), null);
});

test("missing points → null", () => {
  assert.equal(computeAxesYawFromPoints(null, O), null);
  assert.equal(computeAxesYawFromPoints(O, undefined), null);
});
