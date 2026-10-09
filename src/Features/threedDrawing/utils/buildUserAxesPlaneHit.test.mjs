import assert from "node:assert/strict";
import { test } from "node:test";

import { Vector3 } from "three";

import buildUserAxesPlaneHit, {
  getUserAxesInPlane,
} from "./buildUserAxesPlaneHit.js";

const axesAt = (yawDeg = 0) => {
  const yaw = (yawDeg * Math.PI) / 180;
  const up = new Vector3(0, 1, 0);
  return [
    { key: "X", dir: new Vector3(1, 0, 0).applyAxisAngle(up, yaw) },
    { key: "Y", dir: new Vector3(0, 0, 1).applyAxisAngle(up, yaw) },
    { key: "Z", dir: new Vector3(0, 1, 0) },
  ];
};

const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ~ ${expected}`);

test("a horizontal plane takes the X and Y user axes, yaw applied", () => {
  const basis = getUserAxesInPlane({ x: 0, y: 1, z: 0 }, axesAt(30));
  assert.deepEqual(basis.keys, ["X", "Y"]);
  near(basis.u.dot(axesAt(30)[0].dir), 1);
  near(basis.v.dot(axesAt(30)[1].dir), 1);
  near(basis.u.dot(basis.v), 0);
});

test("a plane normal to X takes the Y and Z axes", () => {
  const basis = getUserAxesInPlane({ x: 1, y: 0, z: 0 }, axesAt());
  assert.deepEqual(basis.keys, ["Y", "Z"]);
  near(Math.abs(basis.u.z), 1);
  near(basis.v.y, 1);
});

test("an oblique plane gets the projected axes, orthonormal", () => {
  const n = new Vector3(1, 0, 1).normalize();
  const basis = getUserAxesInPlane(n, axesAt());
  near(basis.u.length(), 1);
  near(basis.v.length(), 1);
  near(basis.u.dot(basis.v), 0);
  near(basis.u.dot(n), 0);
  near(basis.v.dot(n), 0);
  // Z lies in the plane: kept exactly.
  assert.ok(basis.keys.includes("Z"));
});

test("the hit carries the cross arms, the keys and the extra fields", () => {
  const hit = buildUserAxesPlaneHit(
    { x: 1, y: 2, z: 3 },
    { x: 0, y: 1, z: 0 },
    axesAt(),
    { baseMapId: "bm" }
  );
  assert.equal(hit.isNatural, true);
  assert.equal(hit.isFace, false);
  assert.equal(hit.baseMapId, "bm");
  assert.deepEqual(hit.axisKeys, { A: "X", B: "Y" });
  near(hit.axisA[0].distanceTo(hit.axisA[1]), 1);
  near(hit.axisA[0].x, 0.5);
  near(hit.axisB[1].z, 3.5);
  near(hit.position.y, 2);
});
