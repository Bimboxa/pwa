import { test } from "node:test";
import assert from "node:assert/strict";

import isVerticalBandExact from "./isVerticalBandExact.js";

// A vertical face along the plan x axis: (along in m, z in m) corners, plan
// position x = along / 10 (normalized), y = 0.5.
const face = (corners) =>
  corners.map(([along, z]) => ({ x: along / 10, y: 0.5, offset: z }));

test("rectangle, right triangle and sloped top encode exactly", () => {
  assert.equal(isVerticalBandExact(face([[0, 0], [4, 0], [4, 3], [0, 3]])), true);
  assert.equal(isVerticalBandExact(face([[0, 0], [4, 0], [0, 3]])), true);
  assert.equal(isVerticalBandExact(face([[0, 0], [4, 0], [4, 3], [0, 2]])), true);
});

test("a gable whose apex has a corner below it encodes exactly", () => {
  assert.equal(
    isVerticalBandExact(face([[0, 0], [2, 0], [4, 0], [4, 2], [2, 3], [0, 2]])),
    true
  );
});

test("an apex without a corner below it does not", () => {
  assert.equal(isVerticalBandExact(face([[0, 0], [4, 0], [2, 3]])), false);
  assert.equal(
    isVerticalBandExact(face([[0, 0], [4, 0], [4, 2], [2, 3], [0, 2]])),
    false
  );
});

test("L and U contours do not", () => {
  assert.equal(
    isVerticalBandExact(face([[0, 0], [4, 0], [4, 1], [2, 1], [2, 3], [0, 3]])),
    false
  );
  assert.equal(
    isVerticalBandExact(
      face([[0, 0], [6, 0], [6, 3], [4, 3], [4, 1], [2, 1], [2, 3], [0, 3]])
    ),
    false
  );
});

test("a degenerate contour is not a band", () => {
  assert.equal(isVerticalBandExact(face([[0, 0], [0, 3], [0, 1]])), false);
});
