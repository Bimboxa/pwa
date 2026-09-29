import test from "node:test";
import assert from "node:assert/strict";

import { toDisplayedRect, toIntrinsicRect } from "./rotateNormalizedRect.js";

const rect = { x: 0.1, y: 0.2, width: 0.3, height: 0.05 };

function assertRectClose(a, b) {
  for (const k of ["x", "y", "width", "height"]) {
    assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `${k}: ${a[k]} vs ${b[k]}`);
  }
}

test("delta 0 is the identity", () => {
  assertRectClose(toDisplayedRect(rect, 0), rect);
  assertRectClose(toIntrinsicRect(rect, 0), rect);
});

test("90° clockwise: top-left corner goes to the top-right", () => {
  const r = toDisplayedRect({ x: 0, y: 0, width: 0.2, height: 0.1 }, 90);
  assertRectClose(r, { x: 0.9, y: 0, width: 0.1, height: 0.2 });
});

test("180°: top-left corner goes to the bottom-right", () => {
  const r = toDisplayedRect({ x: 0, y: 0, width: 0.2, height: 0.1 }, 180);
  assertRectClose(r, { x: 0.8, y: 0.9, width: 0.2, height: 0.1 });
});

test("270° clockwise: top-left corner goes to the bottom-left", () => {
  const r = toDisplayedRect({ x: 0, y: 0, width: 0.2, height: 0.1 }, 270);
  assertRectClose(r, { x: 0, y: 0.8, width: 0.1, height: 0.2 });
});

test("round trip for every delta, negative and > 360 included", () => {
  for (const delta of [0, 90, 180, 270, -90, 450]) {
    assertRectClose(toIntrinsicRect(toDisplayedRect(rect, delta), delta), rect);
  }
});
