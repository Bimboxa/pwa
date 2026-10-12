import assert from "node:assert/strict";
import { test } from "node:test";

import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";

import computeAxisLockSnap from "./computeAxisLockSnap.js";

const canvasSize = { width: 1000, height: 1000 };
// User axes, yaw 0: X = world X, Y = world Z, Z = world Y (vertical).
const axes = [
  { key: "X", dir: new Vector3(1, 0, 0) },
  { key: "Y", dir: new Vector3(0, 0, 1) },
  { key: "Z", dir: new Vector3(0, 1, 0) },
];
const near = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("top view: the dominant ground axis wins, Z (along the ray) is skipped", () => {
  const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  camera.position.set(0, 10, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const origin = new Vector3(1, 0, 1);
  // Cursor at world (3, 0, 1.4): mostly along X from the origin.
  const snap = computeAxisLockSnap({
    mouseNdc: { x: 3 / 5, y: -1.4 / 5 },
    camera,
    canvasSize,
    origin,
    axes,
  });
  assert.equal(snap.axis, "X");
  near(snap.position.x, 3);
  near(snap.position.y, 0);
  near(snap.position.z, 1);
});

test("perspective view: a cursor above the origin locks on the vertical axis", () => {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(8, 3, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const origin = new Vector3(0, 0, 0);
  const target = new Vector3(0, 2, 0);
  const ndc = target.clone().project(camera);
  const snap = computeAxisLockSnap({
    mouseNdc: { x: ndc.x, y: ndc.y },
    camera,
    canvasSize,
    origin,
    axes,
  });
  assert.equal(snap.axis, "Z");
  near(snap.position.x, 0, 1e-4);
  near(snap.position.y, 2, 1e-4);
  near(snap.position.z, 0, 1e-4);
});
