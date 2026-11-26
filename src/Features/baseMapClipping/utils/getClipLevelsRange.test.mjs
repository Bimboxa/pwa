import assert from "node:assert/strict";
import test from "node:test";

import getClipLevelsRange from "./getClipLevelsRange.js";

test("covers the scene and the box, with padding", () => {
  const range = getClipLevelsRange({
    levels: { z: 2, frontM: 1, backM: 0.5 },
    sceneMinY: 0,
    sceneMaxY: 15,
  });
  assert.ok(range.min < 0 && range.max > 15);
  assert.ok(Math.abs(range.min - -1.5) < 1e-9);
  assert.ok(Math.abs(range.max - 16.5) < 1e-9);
});

test("no scene: around the levels", () => {
  const range = getClipLevelsRange({
    levels: { z: 3, frontM: null, backM: 1 },
  });
  assert.deepEqual(range, { min: 1.5, max: 3.5 });
});

test("keeps the previous range while the levels stay inside it", () => {
  const previous = { min: -2, max: 18 };
  assert.equal(
    getClipLevelsRange({
      levels: { z: 5, frontM: 1, backM: 1 },
      sceneMinY: 0,
      sceneMaxY: 30,
      previous,
    }),
    previous
  );
});

test("a level out of the previous range gives a new one", () => {
  const range = getClipLevelsRange({
    levels: { z: 20, frontM: 1, backM: 1 },
    sceneMinY: 0,
    sceneMaxY: 15,
    previous: { min: -2, max: 18 },
  });
  assert.ok(range.max > 21 && range.min < 0);
});
