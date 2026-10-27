import assert from "node:assert/strict";
import test from "node:test";
import { Group, Matrix4, Vector3 } from "three";
import pick from "./pickLocalScanPoint.js";
import applyPlacement from "./applyLocalScanPlacement.js";

const query = {
  matrix: new Matrix4().elements,
  ndc: [0, 0],
  width: 1000,
  height: 1000,
  origin: [0, 0, 5],
  direction: [0, 0, -1],
  scale: 1,
  pixelAngle: 0.002,
};
function plane(z = 0) {
  const points = [];
  for (let i = -25; i <= 25; i++)
    for (let j = -25; j <= 25; j++) points.push(i * 0.02, j * 0.02, z);
  return points;
}
test("picks the visible front surface, estimates its normal and ray intersection", () => {
  const result = pick(new Float32Array([...plane(0), ...plane(0.5)]), query);
  assert.ok(result.normal);
  assert.ok(
    Math.abs(result.point[0]) < 1e-6 && Math.abs(result.point[1]) < 1e-6
  );
  assert.ok(Math.abs(result.point[2] - 0.5) < 1e-6);
  assert.ok(result.normal[2] > 0.999);
  assert.ok(result.support > 0.99);
});
test("RANSAC tolerates scattered off-plane samples in the neighbourhood", () => {
  const points = plane();
  for (let i = 0; i < 90; i++)
    points.push(
      0.07 + (i % 10) * 0.016,
      ((i % 9) - 4) * 0.025,
      ((i % 7) + 1) * 0.014
    );
  const result = pick(new Float32Array(points), query);
  assert.ok(result.normal);
  assert.ok(Math.abs(result.point[2]) < 0.005);
});
test("empty clicks and clipped points do not invent coordinates", () => {
  assert.equal(
    pick(new Float32Array(plane()), { ...query, ndc: [0.9, 0.9] }),
    null
  );
  assert.equal(pick(new Float32Array(plane(2)), query), null);
});
test("isolated points and linear neighbourhoods do not invent planes", () => {
  assert.equal(pick(new Float32Array([0, 0, 0]), query).normal, null);
  const points = [];
  for (let i = -50; i <= 50; i++) points.push(i * 0.003, 0, 0);
  assert.equal(pick(new Float32Array(points), query).normal, null);
});
test("anchoring a picked point works with both axes and survives scale changes", () => {
  const root = new Group();
  const origin = [4, -2, 7];
  for (const up of ["Z", "Y"])
    for (const scale of [0.001, 1, 100]) {
      applyPlacement(root, { up, scale, origin });
      assert.ok(root.localToWorld(new Vector3(...origin)).length() < 1e-9);
      const shifted = root.localToWorld(new Vector3(5, -2, 7));
      assert.ok(Math.abs(shifted.x - scale) < 1e-9);
    }
  applyPlacement(root, { up: "Z", scale: 1 });
  assert.equal(root.position.length(), 0);
});
