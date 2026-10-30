import assert from "node:assert/strict";
import { test } from "node:test";

import { PerspectiveCamera, Vector3 } from "three";

import computeArrowAxisMapping, {
  isSameArrowAxisMapping,
} from "./computeArrowAxisMapping.js";

// User axes of the gizmo frame (getUserAxesWorldDirections, not node-loadable
// through its "Features/" alias): X = world X, Y = world Z, Z = world Y
// (vertical), X / Y rotated by the yaw around world Y.
function userAxesAt(yawDeg) {
  const yaw = (yawDeg * Math.PI) / 180;
  const up = new Vector3(0, 1, 0);
  return [
    { key: "X", dir: new Vector3(1, 0, 0).applyAxisAngle(up, yaw) },
    { key: "Y", dir: new Vector3(0, 0, 1).applyAxisAngle(up, yaw) },
    { key: "Z", dir: new Vector3(0, 1, 0) },
  ];
}

function cameraAt(position, target = [0, 0, 0], up = [0, 1, 0]) {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(...position);
  camera.up.set(...up);
  camera.lookAt(new Vector3(...target));
  camera.updateMatrixWorld(true);
  return camera;
}

const axes = userAxesAt(0);

test("front view along user Y: Z up, X right, Y is the depth", () => {
  const camera = cameraAt([0, 0, 10]);
  assert.deepEqual(computeArrowAxisMapping(camera, axes), {
    up: "Z",
    right: "X",
    down: "Y",
  });
});

test("top view: Y up, X right, Z (vertical) is the depth", () => {
  // Screen up = world -Z (user -Y): still the Y axis (sign ignored).
  const camera = cameraAt([0, 10, 0], [0, 0, 0], [0, 0, -1]);
  assert.deepEqual(computeArrowAxisMapping(camera, axes), {
    up: "Y",
    right: "X",
    down: "Z",
  });
});

test("tilted view (the usual orbit): Z up, X right, Y down", () => {
  const camera = cameraAt([0, 6, 10]);
  assert.deepEqual(computeArrowAxisMapping(camera, axes), {
    up: "Z",
    right: "X",
    down: "Y",
  });
});

test("side view along user X: Z up, Y right, X is the depth", () => {
  const camera = cameraAt([10, 0, 0]);
  assert.deepEqual(computeArrowAxisMapping(camera, axes), {
    up: "Z",
    right: "Y",
    down: "X",
  });
});

test("the frame yaw rotates the horizontal axes: a 90° yaw swaps X / Y", () => {
  const camera = cameraAt([0, 0, 10]);
  const rotated = userAxesAt(90);
  const mapping = computeArrowAxisMapping(camera, rotated);
  assert.equal(mapping.up, "Z");
  assert.equal(mapping.right, "Y");
  assert.equal(mapping.down, "X");
});

test("null without a camera or with fewer than 3 axes", () => {
  assert.equal(computeArrowAxisMapping(null, axes), null);
  assert.equal(
    computeArrowAxisMapping(cameraAt([0, 0, 10]), axes.slice(1)),
    null
  );
});

test("isSameArrowAxisMapping compares the three keys, null-safe", () => {
  const a = { up: "Z", right: "X", down: "Y" };
  assert.ok(isSameArrowAxisMapping(a, { ...a }));
  assert.ok(!isSameArrowAxisMapping(a, { ...a, right: "Y" }));
  assert.ok(!isSameArrowAxisMapping(a, null));
  assert.ok(isSameArrowAxisMapping(null, null));
});
