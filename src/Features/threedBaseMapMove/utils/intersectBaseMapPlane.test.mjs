import assert from "node:assert/strict";
import { test } from "node:test";

import { clipLineToBox2d } from "./intersectBaseMapPlane.js";

const min = { x: -2, y: -1 };
const max = { x: 2, y: 1 };

test("axis-aligned line through the box: clipped to its borders", () => {
  const span = clipLineToBox2d({ x: 0.5, y: 0.25 }, { x: 1, y: 0 }, min, max);
  assert.deepEqual(span, [-2.5, 1.5]);
});

test("diagonal line through the box: clipped by the tighter slab", () => {
  const s = Math.SQRT1_2;
  const [t0, t1] = clipLineToBox2d({ x: 0, y: 0 }, { x: s, y: s }, min, max);
  // y = ±1 reached first (|y| ≤ 1 while |x| ≤ 2).
  assert.ok(Math.abs(t0 + Math.SQRT2) < 1e-9);
  assert.ok(Math.abs(t1 - Math.SQRT2) < 1e-9);
});

test("line parallel to an edge outside the box: null", () => {
  assert.equal(clipLineToBox2d({ x: 0, y: 5 }, { x: 1, y: 0 }, min, max), null);
});

test("null direction: null", () => {
  assert.equal(clipLineToBox2d({ x: 0, y: 0 }, { x: 0, y: 0 }, min, max), null);
});
