import assert from "node:assert/strict";
import test from "node:test";
import { Matrix4, Vector3 } from "three";

import collect from "./collectLocalScanSlicePoints.js";
import getFrame from "./getLocalScanSectionFrame.js";
import { getBaseMapGroupMatrix } from "./getLocalScanMatrixInBaseMap.js";

const root = new Matrix4()
  .makeRotationY(0.4)
  .setPosition(new Vector3(2, 0.5, -1));
const page = {
  orientation: "VERTICAL",
  angleDeg: 30,
  position: { x: 3, y: 2, z: -2 },
  width: 60,
  height: 40,
  meterByPx: 0.05,
};
const pageMatrix = getBaseMapGroupMatrix(page);
const toSource = root.clone().invert();
// Page local point (x right, y up, z = distance to the plane) → source.
const sourceOf = (x, y, z) =>
  new Vector3(x, y, z).applyMatrix4(pageMatrix).applyMatrix4(toSource);

test("keeps the slab points, in metres from the image top-left, y down", () => {
  const positions = new Float32Array([
    ...sourceOf(0.52, 0.31, 0.004).toArray(), // in the slab
    ...sourceOf(0.52, 0.31, -0.2).toArray(), // behind
    ...sourceOf(-0.4, 0.1, 0.3).toArray(), // in front
    ...sourceOf(40, 0, 0).toArray(), // outside the page
  ]);
  const { points, count, sliceCount } = collect(
    { positions },
    { frame: getFrame(root, page), lower: -0.01, upper: 0.01 }
  );
  assert.equal(count, 1);
  assert.equal(sliceCount, 1);
  // page = 3 m x 2 m, origin at its centre
  assert.ok(Math.abs(points[0] - (0.52 + 1.5)) < 1e-4);
  assert.ok(Math.abs(points[1] - (1 - 0.31)) < 1e-4);
});

test("thins a slice larger than maxPoints evenly", () => {
  const n = 1000;
  const coords = [];
  for (let i = 0; i < n; i++)
    coords.push(...sourceOf(-1.4 + (2.8 * i) / n, 0, 0).toArray());
  const { points, count, sliceCount } = collect(
    { positions: new Float32Array(coords) },
    { frame: getFrame(root, page), lower: -0.01, upper: 0.01, maxPoints: 100 }
  );
  assert.equal(sliceCount, n);
  assert.ok(count <= 100 && count >= 50);
  // still spread over the whole line
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < count; i++) {
    min = Math.min(min, points[i * 2]);
    max = Math.max(max, points[i * 2]);
  }
  assert.ok(min < 0.2 && max > 2.7);
});
