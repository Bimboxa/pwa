import assert from "node:assert/strict";
import { test } from "node:test";

import expandArcsInPath3d, {
  planeFrameFromThreePoints,
} from "./expandArcsInPath3d.js";

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} ~ ${expected}`);

// A circle of radius 2 in a plane tilted 45° about X, centred at C.
const C = { x: 1, y: 2, z: 3 };
const R = 2;
const U = { x: 1, y: 0, z: 0 };
const V = { x: 0, y: Math.SQRT1_2, z: Math.SQRT1_2 };
const N = { x: 0, y: -Math.SQRT1_2, z: Math.SQRT1_2 };
const onCircle = (angle, extra = {}) => ({
  x: C.x + R * (Math.cos(angle) * U.x + Math.sin(angle) * V.x),
  y: C.y + R * (Math.cos(angle) * U.y + Math.sin(angle) * V.y),
  z: C.z + R * (Math.cos(angle) * U.z + Math.sin(angle) * V.z),
  ...extra,
});

test("S-C-S triplet in a tilted plane: samples lie on the circle, in the plane", () => {
  const p0 = onCircle(0, { baseMapId: "bm1" });
  const p1 = onCircle(Math.PI / 2, { type: "circle" });
  const p2 = onCircle(Math.PI, { type: "square" });
  const out = expandArcsInPath3d([p0, p1, p2], 8);
  // p0 + 8 samples (p0→p1, p1 included) + 7 samples (p1→p2, p2 excluded) + p2
  assert.equal(out.length, 1 + 8 + 7 + 1);
  assert.equal(out[0].baseMapId, "bm1");
  assert.equal(out[out.length - 1].type, "square");
  for (const p of out) {
    const d = { x: p.x - C.x, y: p.y - C.y, z: p.z - C.z };
    near(Math.hypot(d.x, d.y, d.z), R);
    near(d.x * N.x + d.y * N.y + d.z * N.z, 0);
  }
  // The arc goes through p1 (the 8th sample).
  near(out[8].x, p1.x);
  near(out[8].y, p1.y);
  near(out[8].z, p1.z);
});

test("collinear triplet: straight, every vertex kept", () => {
  const path = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0, type: "circle" },
    { x: 2, y: 0, z: 0 },
  ];
  const out = expandArcsInPath3d(path, 8);
  assert.deepEqual(out, path);
  assert.equal(planeFrameFromThreePoints(...path), null);
});

test("no arc point: identity copy", () => {
  const path = [
    { x: 0, y: 0, z: 0, baseMapId: "a" },
    { x: 1, y: 0, z: 2 },
    { x: 2, y: 1, z: 0 },
    { x: 3, y: 0, z: 0 },
  ];
  const out = expandArcsInPath3d(path, 8);
  assert.deepEqual(out, path);
  assert.notEqual(out[0], path[0]);
});

test("closed ring: the wrap-around S-C-S arc is sampled too", () => {
  const path = [
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 0, z: 1 },
    { x: 0, y: 0, z: 0, type: "circle" },
  ];
  const out = expandArcsInPath3d(path, 4, true);
  // (1,0,1) → circle (0,0,0) → (1,0,0) wraps: 2 anchors + 4 + 3 samples.
  assert.equal(out.length, 2 + 4 + 3);
  assert.equal(expandArcsInPath3d(path, 4, false).length, 3);
});

test("samples as a function of the sweep angle", () => {
  const calls = [];
  const out = expandArcsInPath3d(
    [onCircle(0), onCircle(Math.PI / 2, { type: "circle" }), onCircle(Math.PI)],
    (sweep) => {
      calls.push(sweep);
      return 3;
    }
  );
  assert.equal(calls.length, 2);
  near(calls[0], Math.PI / 2);
  near(calls[1], Math.PI / 2);
  assert.equal(out.length, 1 + 3 + 2 + 1);
});
