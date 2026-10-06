import assert from "node:assert/strict";
import { test } from "node:test";

import computeRectangleCornersOnPlane from "./computeRectangleCornersOnPlane.js";

const near = (actual, expected, eps = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );
const nearVec = (v, [x, y, z]) => {
  near(v.x, x);
  near(v.y, y);
  near(v.z, z);
};

// A wall face looking toward +Z: u = +X (the viewer's right), v = +Y (up).
const NORMAL = { x: 0, y: 0, z: 1 };
const ANCHOR = { x: 1, y: 0, z: 0 };

test("the cursor's diagonal gives an upright rectangle on the face", () => {
  const corners = computeRectangleCornersOnPlane(
    ANCHOR,
    { x: 3, y: 2, z: 0 },
    NORMAL
  );
  nearVec(corners[0], [1, 0, 0]);
  nearVec(corners[1], [3, 0, 0]);
  nearVec(corners[2], [3, 2, 0]);
  nearVec(corners[3], [1, 2, 0]);
});

test("typed dimensions replace the cursor's, each axis on its own", () => {
  const both = computeRectangleCornersOnPlane(
    ANCHOR,
    { x: 3, y: 2, z: 0 },
    NORMAL,
    { forcedDu: 1.5, forcedDv: -0.5 }
  );
  nearVec(both[2], [2.5, -0.5, 0]);

  const widthOnly = computeRectangleCornersOnPlane(
    ANCHOR,
    { x: 3, y: 2, z: 0 },
    NORMAL,
    { forcedDu: 0.25 }
  );
  nearVec(widthOnly[2], [1.25, 2, 0]);
});

test("a degenerate side (cursor or typed) gives null", () => {
  assert.equal(
    computeRectangleCornersOnPlane(ANCHOR, { x: 1, y: 2, z: 0 }, NORMAL),
    null
  );
  assert.equal(
    computeRectangleCornersOnPlane(ANCHOR, { x: 3, y: 2, z: 0 }, NORMAL, {
      forcedDv: 0,
    }),
    null
  );
});

test("a given basis replaces the one derived from the normal", () => {
  const basis = {
    origin: ANCHOR,
    u: { x: 0, y: 1, z: 0 },
    v: { x: -1, y: 0, z: 0 },
    n: NORMAL,
  };
  const corners = computeRectangleCornersOnPlane(
    ANCHOR,
    { x: 0, y: 1, z: 0 },
    null,
    { basis }
  );
  nearVec(corners[1], [1, 1, 0]);
  nearVec(corners[3], [0, 0, 0]);
});
