import { test } from "node:test";
import assert from "node:assert/strict";

import roundForDisplay from "./roundForDisplay.js";

test("removes float noise", () => {
  assert.equal(roundForDisplay(2.4999999), 2.5);
  assert.equal(roundForDisplay(1.110339449), 1.1103);
  assert.equal(roundForDisplay(-0.30000000000000004), -0.3);
});

test("never moves a value by more than 0.05 mm", () => {
  for (const value of [0.004, 1.2345, 12.345, -0.051361, -0.006068, 0.999]) {
    assert.ok(Math.abs(roundForDisplay(value) - value) <= 5e-5 + 1e-12);
  }
  // The former rules: 0.004 → 0, 1.2345 → 1.23, 12.345 → 12.3.
  assert.equal(roundForDisplay(0.004), 0.004);
  assert.equal(roundForDisplay(12.345), 12.345);
});

test("zero and non finite values", () => {
  assert.equal(Object.is(roundForDisplay(-0.00001), 0), true);
  assert.equal(roundForDisplay(NaN), 0);
  assert.equal(roundForDisplay(undefined), 0);
});
