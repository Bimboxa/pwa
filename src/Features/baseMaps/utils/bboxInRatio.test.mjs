import assert from "node:assert/strict";
import { test } from "node:test";
import { bboxKey, normalizeBboxInRatio, sameBboxInRatio } from "./bboxInRatio.js";

test("normalizeBboxInRatio: missing, invalid and whole-page boxes are null", () => {
  assert.equal(normalizeBboxInRatio(null), null);
  assert.equal(normalizeBboxInRatio({ x1: 0, y1: 0, x2: 1 }), null);
  assert.equal(normalizeBboxInRatio({ x1: "0", y1: 0, x2: 1, y2: 1 }), null);
  assert.equal(normalizeBboxInRatio({ x1: 0, y1: 0, x2: 1, y2: 1 }), null);
  assert.equal(normalizeBboxInRatio({ x1: -0.2, y1: 0, x2: 1.4, y2: 1 }), null);
  // empty box
  assert.equal(normalizeBboxInRatio({ x1: 0.3, y1: 0.2, x2: 0.3, y2: 0.9 }), null);
});

test("normalizeBboxInRatio clamps, orders and rounds to 4 decimals", () => {
  assert.deepEqual(
    normalizeBboxInRatio({ x1: 0.61234567, y1: -0.1, x2: 0.1, y2: 0.5 }),
    { x1: 0.1, y1: 0, x2: 0.6123, y2: 0.5 }
  );
});

test("sameBboxInRatio tolerates a thousandth and separates a zone from the whole page", () => {
  const a = { x1: 0.1, y1: 0.2, x2: 0.6, y2: 0.7 };
  assert.equal(sameBboxInRatio(a, { x1: 0.1004, y1: 0.2, x2: 0.6, y2: 0.7005 }), true);
  assert.equal(sameBboxInRatio(a, { x1: 0.11, y1: 0.2, x2: 0.6, y2: 0.7 }), false);
  assert.equal(sameBboxInRatio(null, undefined), true);
  assert.equal(sameBboxInRatio(null, { x1: 0, y1: 0, x2: 1, y2: 1 }), true);
  assert.equal(sameBboxInRatio(a, null), false);
});

test("bboxKey is empty for the whole page and stable for a zone", () => {
  assert.equal(bboxKey(null), "");
  assert.equal(bboxKey({ x1: 0.1, y1: 0.2, x2: 0.6, y2: 0.7 }), "@b0.1,0.2,0.6,0.7");
});
