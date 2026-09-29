import test from "node:test";
import assert from "node:assert/strict";

import getBusinessObjectQtyGap from "./getBusinessObjectQtyGap.js";

test("gap over the 5% threshold", () => {
  assert.equal(getBusinessObjectQtyGap(104, 100).isOver, false);
  assert.equal(getBusinessObjectQtyGap(105, 100).isOver, false);
  assert.equal(getBusinessObjectQtyGap(106, 100).isOver, true);
  assert.equal(getBusinessObjectQtyGap(90, 100).isOver, true);
  assert.equal(getBusinessObjectQtyGap(90, 100).delta, -10);
});

test("null reference", () => {
  assert.equal(getBusinessObjectQtyGap(0, 0).isOver, false);
  assert.equal(getBusinessObjectQtyGap(2, 0).isOver, true);
});

test("missing quantity", () => {
  assert.equal(getBusinessObjectQtyGap(null, 100), null);
  assert.equal(getBusinessObjectQtyGap(100, null), null);
  assert.equal(getBusinessObjectQtyGap(100, undefined), null);
});
