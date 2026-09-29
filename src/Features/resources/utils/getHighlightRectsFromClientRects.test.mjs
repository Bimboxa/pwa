import test from "node:test";
import assert from "node:assert/strict";

import getHighlightRectsFromClientRects from "./getHighlightRectsFromClientRects.js";

const containerRect = { left: 100, top: 50, width: 400, height: 800 };
const box = (left, top, width, height) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

test("returns nothing without a container or rects", () => {
  assert.deepEqual(
    getHighlightRectsFromClientRects({ clientRects: [], containerRect }),
    []
  );
  assert.deepEqual(
    getHighlightRectsFromClientRects({
      clientRects: [box(0, 0, 10, 10)],
      containerRect: null,
    }),
    []
  );
});

test("merges the spans of one line and normalizes", () => {
  const rects = getHighlightRectsFromClientRects({
    clientRects: [
      box(140, 90, 100, 20),
      box(240, 91, 60, 19),
      box(140, 90, 100, 20), // duplicate
    ],
    containerRect,
  });
  assert.equal(rects.length, 1);
  assert.ok(Math.abs(rects[0].x - 0.1) < 1e-9);
  assert.ok(Math.abs(rects[0].y - 0.05) < 1e-9);
  assert.ok(Math.abs(rects[0].width - 0.4) < 1e-9);
  assert.ok(Math.abs(rects[0].height - 0.025) < 1e-9);
});

test("keeps one rect per line, top to bottom", () => {
  const rects = getHighlightRectsFromClientRects({
    clientRects: [box(120, 130, 300, 20), box(120, 100, 200, 20)],
    containerRect,
  });
  assert.equal(rects.length, 2);
  assert.ok(rects[0].y < rects[1].y);
});

test("clips to the page and drops empty / outside rects", () => {
  const rects = getHighlightRectsFromClientRects({
    clientRects: [
      box(50, 100, 100, 20), // overflows on the left
      box(120, 100, 0, 20), // empty
      box(600, 100, 50, 20), // outside
    ],
    containerRect,
  });
  assert.equal(rects.length, 1);
  assert.equal(rects[0].x, 0);
  assert.ok(Math.abs(rects[0].width - 0.125) < 1e-9);
});
