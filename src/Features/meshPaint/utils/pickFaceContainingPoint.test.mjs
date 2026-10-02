import assert from "node:assert/strict";
import { test } from "node:test";

import { v } from "./meshPaintTestFixtures.mjs";
import pickFaceContainingPoint from "./pickFaceContainingPoint.js";

// Plane-mode region of a carved wall front (y = 0): two islands left and
// right of a door, plus the door-head island above it.
const left = {
  contour: [v(0, 0, 0), v(2, 0, 0), v(2, 0, 2.1), v(0, 0, 2.1)],
  holes: [],
  normal: v(0, -1, 0),
};
const right = {
  contour: [v(3, 0, 0), v(5, 0, 0), v(5, 0, 2.1), v(3, 0, 2.1)],
  holes: [],
  normal: v(0, -1, 0),
};
// Island with a window hole.
const upper = {
  contour: [v(0, 0, 2.1), v(5, 0, 2.1), v(5, 0, 2.5), v(0, 0, 2.5)],
  holes: [[v(1, 0, 2.2), v(1, 0, 2.4), v(1.5, 0, 2.4), v(1.5, 0, 2.2)]],
  normal: v(0, -1, 0),
};

test("pickFaceContainingPoint: island under the hit point", () => {
  const faces = [left, right, upper];
  assert.equal(pickFaceContainingPoint(faces, v(1, 0, 1)), 0);
  assert.equal(pickFaceContainingPoint(faces, v(4, 0.0004, 1)), 1);
  assert.equal(pickFaceContainingPoint(faces, v(3, 0, 2.3)), 2);
});

test("pickFaceContainingPoint: hole and boundary fallbacks", () => {
  const faces = [left, right, upper];
  // In the window hole of `upper`: nearest boundary wins (upper's hole).
  assert.equal(pickFaceContainingPoint(faces, v(1.25, 0, 2.3)), 2);
  // In the door gap, nearer to the right island.
  assert.equal(pickFaceContainingPoint(faces, v(2.9, 0, 1)), 1);
  // On a shared boundary (float noise): some face, never -1.
  assert.ok(pickFaceContainingPoint(faces, v(2, 0, 2.1)) >= 0);
});

test("pickFaceContainingPoint: nearest plane among containing faces", () => {
  const behind = {
    ...left,
    contour: left.contour.map((p) => v(p.x, 0.2, p.z)),
    normal: v(0, 1, 0),
  };
  assert.equal(pickFaceContainingPoint([behind, left], v(1, 0.001, 1)), 1);
  assert.equal(pickFaceContainingPoint([behind, left], v(1, 0.199, 1)), 0);
});

test("pickFaceContainingPoint: empty / degenerate", () => {
  assert.equal(pickFaceContainingPoint([], v(0, 0, 0)), -1);
  assert.equal(pickFaceContainingPoint(null, v(0, 0, 0)), -1);
  assert.equal(
    pickFaceContainingPoint(
      [{ contour: [v(0, 0, 0), v(1, 0, 0)], holes: [] }],
      v(0, 0, 0)
    ),
    -1
  );
});
