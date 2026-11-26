import assert from "node:assert/strict";
import test from "node:test";

import getVisibleClipLayerRange from "./getVisibleClipLayerRange.js";

test("looking at the front face: the front layer", () => {
  assert.deepEqual(getVisibleClipLayerRange({ frontM: 0.5, backM: 2 }, -0.8), {
    side: "front",
    lower: 0,
    upper: 0.5,
  });
});

test("looking at the back face: the back layer", () => {
  assert.deepEqual(getVisibleClipLayerRange({ frontM: 0.5, backM: 2 }, 0.3), {
    side: "back",
    lower: -2,
    upper: 0,
  });
});

test("no limit on the seen side: a finite, huge layer", () => {
  const range = getVisibleClipLayerRange({ frontM: null, backM: 1 }, -1);
  assert.equal(range.lower, 0);
  assert.ok(Number.isFinite(range.upper) && range.upper > 1e5);
});
