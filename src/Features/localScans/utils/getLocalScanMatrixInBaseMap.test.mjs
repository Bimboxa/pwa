import assert from "node:assert/strict";
import test from "node:test";
import { Group, Matrix4, Vector3 } from "three";
import {
  BASE_MAP_ROTATION_ORDER,
  getBaseMapEuler,
} from "../../baseMaps/js/getBaseMapTransform.js";
import applyPlacement from "./applyLocalScanPlacement.js";
import getMatrix from "./getLocalScanMatrixInBaseMap.js";

function poseGroup(group, pose) {
  const euler = getBaseMapEuler(pose);
  group.rotation.set(euler.x, euler.y, euler.z, BASE_MAP_ROTATION_ORDER);
  group.position.set(pose.position.x, pose.position.y, pose.position.z);
  group.updateMatrixWorld(true);
}

test("the scan glued to a base map follows every later move rigidly", () => {
  const root = new Group();
  applyPlacement(root, { up: "Z", scale: 1.5, origin: [3, -2, 1], yaw: 28 });
  const created = {
    orientation: "HORIZONTAL",
    angleDeg: -17,
    position: { x: 4, y: 2.5, z: -6 },
  };
  const matrix = getMatrix(root.matrixWorld, created);

  const group = new Group();
  const wrap = new Group();
  new Matrix4()
    .fromArray(matrix)
    .decompose(wrap.position, wrap.quaternion, wrap.scale);
  group.add(wrap);
  poseGroup(group, created);

  const sources = [
    new Vector3(0, 0, 0),
    new Vector3(5, 1, -2),
    new Vector3(-3, 7, 4),
  ];
  // At creation the glued scan is exactly where the tool showed it.
  for (const p of sources) {
    const expected = p.clone().applyMatrix4(root.matrixWorld);
    const actual = p.clone().applyMatrix4(wrap.matrixWorld);
    assert.ok(actual.distanceTo(expected) < 1e-9);
  }

  // Moving / rotating the map moves the scan by the same rigid transform.
  const before = new Matrix4().copy(group.matrixWorld);
  const moved = {
    orientation: "HORIZONTAL",
    angleDeg: 64,
    position: { x: -10, y: 0.4, z: 3 },
  };
  poseGroup(group, moved);
  const delta = new Matrix4()
    .copy(group.matrixWorld)
    .multiply(before.clone().invert());
  for (const p of sources) {
    const expected = p
      .clone()
      .applyMatrix4(root.matrixWorld)
      .applyMatrix4(delta);
    const actual = p.clone().applyMatrix4(wrap.matrixWorld);
    assert.ok(actual.distanceTo(expected) < 1e-9);
  }
});
