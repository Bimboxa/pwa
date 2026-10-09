import assert from "node:assert/strict";
import { test } from "node:test";

import { Vector3 } from "three";

import pickNaturalPlane from "./pickNaturalPlane.js";

// User axes, yaw 0 (getUserAxesWorldDirections): X = world X, Y = world Z,
// Z = world Y (vertical).
const axesAt = (yawDeg = 0) => {
  const yaw = (yawDeg * Math.PI) / 180;
  const up = new Vector3(0, 1, 0);
  return [
    { key: "X", dir: new Vector3(1, 0, 0).applyAxisAngle(up, yaw) },
    { key: "Y", dir: new Vector3(0, 0, 1).applyAxisAngle(up, yaw) },
    { key: "Z", dir: new Vector3(0, 1, 0) },
  ];
};
const origin = { x: 1, y: 2, z: 3 };

const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ~ ${expected}`);

test("a top-down view draws on the horizontal plane (normal Z)", () => {
  const plane = pickNaturalPlane(new Vector3(0, -1, 0), {
    through: origin,
    userAxes: axesAt(),
  });
  assert.equal(plane.axisKey, "Z");
  assert.equal(plane.isSupport, false);
  near(Math.abs(plane.normal.y), 1);
});

test("a view along world X draws on the plane normal to X", () => {
  const plane = pickNaturalPlane(new Vector3(-0.9, -0.2, 0.1), {
    through: origin,
    userAxes: axesAt(),
  });
  assert.equal(plane.axisKey, "X");
});

test("yaw 90° swaps the horizontal axes", () => {
  const plane = pickNaturalPlane(new Vector3(-1, 0, 0), {
    through: origin,
    userAxes: axesAt(90),
  });
  assert.equal(plane.axisKey, "Y");
  near(Math.abs(plane.normal.x), 1);
});

test("the plane containing the 2nd point is preferred", () => {
  // Nearly top-down, but P2 is 1 m above P1: the horizontal plane through
  // P1 does not contain it — a vertical plane does.
  const plane = pickNaturalPlane(new Vector3(0.3, -0.9, 0.1), {
    through: origin,
    userAxes: axesAt(),
    mustContain: [{ x: 1, y: 3, z: 3 }],
  });
  assert.equal(plane.axisKey, "X");
});

test("no candidate contains the point: every plane is considered", () => {
  const plane = pickNaturalPlane(new Vector3(0, -1, 0), {
    through: origin,
    userAxes: axesAt(),
    mustContain: [{ x: 2, y: 3, z: 4 }],
  });
  assert.equal(plane.axisKey, "Z");
});

test("a tie goes to the support plane, which carries the parallel axis", () => {
  const plane = pickNaturalPlane(new Vector3(0, -1, 0), {
    through: origin,
    userAxes: axesAt(),
    supportNormal: { x: 0, y: 1, z: 0 },
  });
  assert.equal(plane.isSupport, true);
  assert.equal(plane.axisKey, "Z");
});

test("a rotated elevation seen head-on beats the axis planes", () => {
  const support = new Vector3(Math.cos(0.5), 0, Math.sin(0.5));
  const plane = pickNaturalPlane(support.clone().negate(), {
    through: origin,
    userAxes: axesAt(),
    supportNormal: support,
  });
  assert.equal(plane.isSupport, true);
  assert.equal(plane.axisKey, null);
});

test("without a view or point: null", () => {
  assert.equal(pickNaturalPlane(null, { through: origin }), null);
  assert.equal(pickNaturalPlane(new Vector3(0, -1, 0), {}), null);
});
