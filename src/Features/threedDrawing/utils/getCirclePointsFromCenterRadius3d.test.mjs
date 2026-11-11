import assert from "node:assert/strict";
import { test } from "node:test";

import expandArcsInPath3d from "./expandArcsInPath3d.js";
import getCirclePointsFromCenterRadius3d from "./getCirclePointsFromCenterRadius3d.js";

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} ~ ${expected}`);

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test("horizontal circle: 4 points S-C-S-C at the radius, rim point first", () => {
  const center = { x: 1, y: 2, z: 3 };
  const rim = { x: 3, y: 2, z: 3 };
  const points = getCirclePointsFromCenterRadius3d(center, rim, {
    x: 0,
    y: 1,
    z: 0,
  });
  assert.equal(points.length, 4);
  assert.deepEqual(
    points.map((p) => p.type),
    ["square", "circle", "square", "circle"]
  );
  near(points[0].x, 3);
  near(points[0].z, 3);
  near(points[2].x, -1);
  for (const p of points) {
    near(distance(p, center), 2);
    near(p.y, 2);
  }
});

test("rim point off the plane: projected, the circle stays on the plane", () => {
  const center = { x: 0, y: 0, z: 0 };
  const points = getCirclePointsFromCenterRadius3d(
    center,
    { x: 1, y: 0.5, z: 0 },
    { x: 0, y: 2, z: 0 }
  );
  for (const p of points) {
    near(p.y, 0);
    near(distance(p, center), 1);
  }
});

test("vertical circle (wall plane)", () => {
  const center = { x: 0, y: 1, z: 0 };
  const points = getCirclePointsFromCenterRadius3d(
    center,
    { x: 0.5, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 }
  );
  for (const p of points) {
    near(p.z, 0);
    near(distance(p, center), 0.5);
  }
  near(Math.abs(points[1].y - 1), 0.5);
});

test("closed and expanded: every sampled point is on the circle", () => {
  const center = { x: 0, y: 0, z: 0 };
  const points = getCirclePointsFromCenterRadius3d(
    center,
    { x: 2, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }
  );
  const ring = expandArcsInPath3d(points, 8, true);
  assert.ok(ring.length > 8);
  for (const p of ring) near(distance(p, center), 2, 1e-5);
});

test("degenerate inputs return null", () => {
  const center = { x: 0, y: 0, z: 0 };
  const up = { x: 0, y: 1, z: 0 };
  assert.equal(getCirclePointsFromCenterRadius3d(center, center, up), null);
  // Rim straight above the centre: no in-plane radius.
  assert.equal(
    getCirclePointsFromCenterRadius3d(center, { x: 0, y: 3, z: 0 }, up),
    null
  );
  assert.equal(
    getCirclePointsFromCenterRadius3d(
      center,
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 }
    ),
    null
  );
});
