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
  // Both parallel planes now fit inside the wider cube.
  assert.ok(result.support > 0.45 && result.support < 0.55);
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

test("a sparse patch spanning the one metre cube is found even at close range", () => {
  const points = [];
  for (const x of [-0.4, -0.2, 0, 0.2, 0.4])
    for (const y of [-0.4, -0.2, 0, 0.2, 0.4]) points.push(x, y, 0);
  points.push(0.51, 0, 0, -0.51, 0, 0, 0, 0.51, 0, 0, 0, -0.51);
  const result = pick(new Float32Array(points), {
    ...query,
    origin: [0, 0, 0.1],
  });
  assert.ok(result.normal);
  assert.equal(result.neighbourCount, 25);
  assert.ok(result.normal[2] > 0.999);
});
test("prefers the nearby sparse plane over a denser parallel plane", () => {
  const points = [];
  for (let i = -10; i <= 10; i++)
    for (let j = -10; j <= 10; j++)
      points.push(i * 0.04, j * 0.04, 0.3 + Math.sin(i * j) * 0.007);
  for (let i = -15; i <= 15; i++)
    for (let j = -15; j <= 15; j++) points.push(i * 0.03, j * 0.03, 0);
  const result = pick(new Float32Array(points), query);
  assert.ok(result.normal);
  assert.ok(Math.abs(result.point[2] - 0.3) < 0.01);
  assert.ok(result.support < 0.4);
});
test("the cube and tolerance use metres at any import scale", () => {
  const points = [];
  for (let i = -5; i <= 5; i++)
    for (let j = -5; j <= 5; j++) points.push(i * 80, j * 80, 0);
  points.push(510, 0, 0);
  const result = pick(new Float32Array(points), {
    ...query,
    scale: 0.001,
    matrix: new Matrix4().makeScale(0.001, 0.001, 0.001).elements,
    origin: [0, 0, 5000],
  });
  assert.ok(result.normal);
  assert.equal(result.neighbourCount, 121);
  assert.equal(result.radius, 500);
});
test("grazing views retain a supported plane without distant intersections", () => {
  const result = pick(new Float32Array(plane()), {
    ...query,
    origin: [0, 0, 0.1],
    direction: [1, 0, -0.001],
  });
  assert.ok(result.normal);
  assert.ok(Math.hypot(...result.point) < 0.1);
});
test("volumetric noise alone is not enough to claim a plane", () => {
  let seed = 32;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296 - 0.5;
  const points = [0, 0, 0.5];
  for (let i = 0; i < 6000; i++)
    points.push(random(), random(), random() + 0.5);
  const result = pick(new Float32Array(points), {
    ...query,
    origin: [0, 0, 0.501],
  });
  assert.equal(result.normal, null);
});
