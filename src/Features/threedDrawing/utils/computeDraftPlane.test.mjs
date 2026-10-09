import assert from "node:assert/strict";
import { test } from "node:test";

import computeDraftPlane, { computeNewellNormal } from "./computeDraftPlane.js";

const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ~ ${expected}`);

test("a square on the ground: horizontal plane through its first point", () => {
  const plane = computeDraftPlane([
    { x: 0, y: 0.5, z: 0 },
    { x: 2, y: 0.5, z: 0 },
    { x: 2, y: 0.5, z: 2 },
    { x: 0, y: 0.5, z: 2 },
  ]);
  near(Math.abs(plane.normal.y), 1);
  near(plane.point.y, 0.5);
  near(plane.point.x, 0);
});

test("three points of a wall: vertical plane", () => {
  const plane = computeDraftPlane([
    { x: 0, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
    { x: 3, y: 2.5, z: 0 },
  ]);
  near(Math.abs(plane.normal.z), 1);
});

test("collinear or too few points: no plane", () => {
  assert.equal(
    computeDraftPlane([
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2.5, y: 0, z: 0.0005 },
    ]),
    null
  );
  assert.equal(
    computeDraftPlane([
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ]),
    null
  );
});

test("the Newell normal survives collinear first points", () => {
  const n = computeNewellNormal([
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 2, y: 0, z: 1 },
  ]);
  near(Math.abs(n.y), 1);
});
