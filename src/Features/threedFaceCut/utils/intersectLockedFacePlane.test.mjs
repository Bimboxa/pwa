import assert from "node:assert/strict";
import { test } from "node:test";

import intersectLockedFacePlane from "./intersectLockedFacePlane.js";

const v = (x, y, z) => ({ x, y, z });
const near = (actual, expected, eps = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );

// Vertical wall face in the plane z = 0, [0,2] × [0,1], outward normal +z,
// with a 0.4 × 0.4 hole in the middle.
const face = {
  point: v(0, 0, 0),
  normal: v(0, 0, 1),
  loops: [
    [v(0, 0, 0), v(2, 0, 0), v(2, 1, 0), v(0, 1, 0)],
    [v(0.8, 0.3, 0), v(0.8, 0.7, 0), v(1.2, 0.7, 0), v(1.2, 0.3, 0)],
  ],
};

const rayDownTo = (x, y, z0 = 5) => ({
  origin: v(x, y, z0),
  direction: v(0, 0, -1),
});

test("hit on the face: position on the plane, camera-facing normal", () => {
  const hit = intersectLockedFacePlane(rayDownTo(0.5, 0.5), face);
  assert.ok(hit);
  near(hit.position.z, 0);
  near(hit.position.x, 0.5);
  near(hit.distance, 5);
  near(hit.normal.z, 1);
  assert.equal(hit.inside, true);
});

test("hit on the plane outside the outline, and in a hole", () => {
  assert.equal(intersectLockedFacePlane(rayDownTo(3, 0.5), face).inside, false);
  assert.equal(intersectLockedFacePlane(rayDownTo(1, 0.5), face).inside, false);
  // Just off the outline: within the slack.
  assert.equal(
    intersectLockedFacePlane(rayDownTo(2.005, 0.5), face).inside,
    true
  );
});

test("back side refused unless double sided; normal then faces the camera", () => {
  const fromBehind = { origin: v(0.5, 0.5, -5), direction: v(0, 0, 1) };
  assert.equal(intersectLockedFacePlane(fromBehind, face), null);
  const hit = intersectLockedFacePlane(fromBehind, face, { doubleSided: true });
  assert.ok(hit);
  near(hit.normal.z, -1);
  assert.equal(hit.inside, true);
});

test("parallel ray, plane behind the camera, clipped point", () => {
  const parallel = { origin: v(0, 0, 1), direction: v(1, 0, 0) };
  assert.equal(intersectLockedFacePlane(parallel, face), null);
  const away = { origin: v(0.5, 0.5, 5), direction: v(0, 0, 1) };
  assert.equal(intersectLockedFacePlane(away, face), null);
  assert.equal(
    intersectLockedFacePlane(rayDownTo(0.5, 0.5), face, {
      isVisible: () => false,
    }),
    null
  );
});
