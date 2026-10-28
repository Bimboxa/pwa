import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import getOrthoRayAxis from "./getOrthoRayAxis.js";

// getUserAxesWorldDirections (not importable here: "Features" alias) for a
// yaw: user X = world +X, user Y = world +Z, both rotated around world Y,
// user Z = world +Y.
const UP = new Vector3(0, 1, 0);
const getUserAxesWorldDirections = (yawDeg) => {
  const yaw = (yawDeg * Math.PI) / 180;
  return [
    {
      key: "X",
      color: "#e5484d",
      dir: new Vector3(1, 0, 0).applyAxisAngle(UP, yaw),
    },
    {
      key: "Y",
      color: "#46a758",
      dir: new Vector3(0, 0, 1).applyAxisAngle(UP, yaw),
    },
    { key: "Z", color: "#3b82f6", dir: new Vector3(0, 1, 0) },
  ];
};

const start = new Vector3(0, 1.1, 0.4);
const view = new Vector3(0, 0, -1);
const close = (a, b) => assert.ok(a.distanceTo(b) < 1e-9, `${a.toArray()}`);

test("the half-axis most aligned with the aim from the first point", () => {
  const axes = getUserAxesWorldDirections(0);
  const x = getOrthoRayAxis(start, new Vector3(3, 1.5, 1), axes, view);
  assert.equal(x.id, "X+");
  close(x.dir, new Vector3(1, 0, 0));
  assert.equal(x.color, axes[0].color);
  // User Y is world Z, user Z is world Y (up).
  assert.equal(
    getOrthoRayAxis(start, new Vector3(0.2, 1, -4), axes, view).id,
    "Y-"
  );
  const up = getOrthoRayAxis(start, new Vector3(0.3, 3.5, 0.6), axes, view);
  assert.equal(up.id, "Z+");
  close(up.dir, new Vector3(0, 1, 0));
});

test("the frame yaw rotates X / Y, aiming at the first point uses the view", () => {
  const axes = getUserAxesWorldDirections(90);
  const rotated = getOrthoRayAxis(start, new Vector3(0.1, 1.1, -3), axes, view);
  assert.equal(rotated.key, "X");
  close(rotated.dir, new Vector3(0, 0, -1));
  const onPoint = getOrthoRayAxis(start, start.clone(), axes, view);
  assert.equal(onPoint.id, "X+");
  close(onPoint.dir, new Vector3(0, 0, -1));
});
