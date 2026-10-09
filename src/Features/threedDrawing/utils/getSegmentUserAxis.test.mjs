import assert from "node:assert/strict";
import { test } from "node:test";

import getSegmentUserAxis from "./getSegmentUserAxis.js";

const axes = [
  { key: "X", dir: { x: 1, y: 0, z: 0 } },
  { key: "Y", dir: { x: 0, y: 0, z: 1 } },
  { key: "Z", dir: { x: 0, y: 1, z: 0 } },
];
const o = { x: 1, y: 1, z: 1 };

test("a segment along a user axis, either way, gets its key", () => {
  assert.equal(getSegmentUserAxis(o, { x: 3, y: 1, z: 1 }, axes), "X");
  assert.equal(getSegmentUserAxis(o, { x: 1, y: -2, z: 1 }, axes), "Z");
  assert.equal(getSegmentUserAxis(o, { x: 1, y: 1, z: 0.5 }, axes), "Y");
});

test("0.5° off is still along the axis, 1° off is not", () => {
  const tan = (deg) => Math.tan((deg * Math.PI) / 180);
  assert.equal(
    getSegmentUserAxis(o, { x: 1 + 2, y: 1 + 2 * tan(0.4), z: 1 }, axes),
    "X"
  );
  assert.equal(
    getSegmentUserAxis(o, { x: 1 + 2, y: 1 + 2 * tan(1), z: 1 }, axes),
    null
  );
});

test("a diagonal or a sub-millimetre segment has no axis", () => {
  assert.equal(getSegmentUserAxis(o, { x: 2, y: 2, z: 1 }, axes), null);
  assert.equal(getSegmentUserAxis(o, { x: 1.0005, y: 1, z: 1 }, axes), null);
  assert.equal(getSegmentUserAxis(null, o, axes), null);
});
