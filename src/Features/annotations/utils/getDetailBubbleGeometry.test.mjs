import assert from "node:assert/strict";
import { test } from "node:test";
import getDetailBubbleGeometry from "./getDetailBubbleGeometry.js";

// Deterministic measure: 0.6 em per glyph.
const measureTextWidth = (text, fontSize) => text.length * fontSize * 0.6;
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("short refs keep the minimum radius", () => {
  const g = getDetailBubbleGeometry({
    text: "X",
    fontSize: 12,
    measureTextWidth,
  });
  assert.ok(close(g.radius, 12 * 0.95));
});

test("empty text is sized like the 'X' placeholder", () => {
  const empty = getDetailBubbleGeometry({
    text: "",
    fontSize: 12,
    measureTextWidth,
  });
  const x = getDetailBubbleGeometry({
    text: "X",
    fontSize: 12,
    measureTextWidth,
  });
  assert.deepEqual(empty, x);
});

test("the radius grows with the text and the circle contains the text box", () => {
  const short = getDetailBubbleGeometry({
    text: "A12",
    fontSize: 12,
    measureTextWidth,
  });
  const long = getDetailBubbleGeometry({
    text: "DET-A12-bis",
    fontSize: 12,
    measureTextWidth,
  });
  assert.ok(long.radius > short.radius);
  for (const g of [short, long]) {
    assert.ok(g.radius > Math.hypot(g.textWidth / 2, g.textHeight / 2));
  }
});

test("every length is proportional to the font size", () => {
  const a = getDetailBubbleGeometry({
    text: "A12",
    fontSize: 12,
    measureTextWidth,
  });
  const b = getDetailBubbleGeometry({
    text: "A12",
    fontSize: 24,
    measureTextWidth,
  });
  for (const key of Object.keys(a)) {
    assert.ok(close(b[key], a[key] * 2, 1e-6), key);
  }
});

test("multi-line text uses the widest line and the stacked height", () => {
  const g = getDetailBubbleGeometry({
    text: "AB\nABCD",
    fontSize: 10,
    measureTextWidth,
  });
  assert.ok(close(g.textWidth, 4 * 10 * 0.6));
  assert.ok(close(g.textHeight, 2 * 10 * 1.2));
});

test("falls back on an estimate without a measure", () => {
  const g = getDetailBubbleGeometry({ text: "A12", fontSize: 12 });
  assert.ok(close(g.textWidth, 3 * 12 * 0.6));
});
