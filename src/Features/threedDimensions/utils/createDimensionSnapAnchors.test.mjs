import assert from "node:assert/strict";
import { test } from "node:test";

import createDimensionSnapAnchors from "./createDimensionSnapAnchors.js";

test("measured points become [x, y, z] snap anchors", () => {
  const obj = createDimensionSnapAnchors([
    { x: 1, y: 2, z: 3 },
    { x: -4, y: 5.5, z: 0 },
  ]);
  assert.ok(obj);
  assert.deepEqual(obj.userData.snapAnchors, [
    [1, 2, 3],
    [-4, 5.5, 0],
  ]);
  assert.equal(obj.userData.isDimensionSnapAnchors, true);
  assert.equal(obj.children.length, 0);
});

test("non-finite points are dropped", () => {
  const obj = createDimensionSnapAnchors([
    { x: 1, y: 2, z: NaN },
    { x: 0, y: 0, z: 0 },
    null,
    { x: Infinity, y: 0, z: 0 },
  ]);
  assert.deepEqual(obj.userData.snapAnchors, [[0, 0, 0]]);
});

test("no finite point → null (nothing to add to the group)", () => {
  assert.equal(createDimensionSnapAnchors([]), null);
  assert.equal(createDimensionSnapAnchors(undefined), null);
  assert.equal(createDimensionSnapAnchors([{ x: 1, y: 2 }]), null);
});
