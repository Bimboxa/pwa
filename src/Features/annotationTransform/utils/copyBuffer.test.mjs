import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_COPIES,
  appendToMoveBuffer,
  formatCopyCountBuffer,
  formatMoveBadge,
  formatMoveLengthBuffer,
  parseCopyCount,
  parseMoveLength,
  scaleDeltaToLength,
} from "./copyBuffer.js";

test("digits feed the distance, * opens the count, digits then feed it", () => {
  assert.equal(appendToMoveBuffer("", "1"), "1");
  assert.equal(appendToMoveBuffer("1", "."), "1.");
  assert.equal(appendToMoveBuffer("1.", ","), "1.");
  assert.equal(appendToMoveBuffer("1.", "3"), "1.3");
  assert.equal(appendToMoveBuffer("", "."), "0.");
  assert.equal(appendToMoveBuffer("1.3", "*"), "1.3*");
  assert.equal(appendToMoveBuffer("1.3*", "3"), "1.3*3");
  assert.equal(appendToMoveBuffer("1.3*3", "."), "1.3*3");
  assert.equal(appendToMoveBuffer("1.3*3", "*"), "1.3*");
  assert.equal(appendToMoveBuffer("", "*"), "*");
  assert.equal(appendToMoveBuffer("*", "3"), "*3");
  assert.equal(appendToMoveBuffer("*3", "x"), "*3");
});

test("the count is capped", () => {
  assert.equal(appendToMoveBuffer("*99", "9"), "*99");
  assert.equal(parseCopyCount(`*${MAX_COPIES + 50}`), MAX_COPIES);
});

test("parseCopyCount / parseMoveLength", () => {
  assert.equal(parseCopyCount(""), 0);
  assert.equal(parseCopyCount(undefined), 0);
  assert.equal(parseCopyCount("*"), 0);
  assert.equal(parseCopyCount("*0"), 0);
  assert.equal(parseCopyCount("*12"), 12);
  assert.equal(parseCopyCount("1.3"), 0);
  assert.equal(parseCopyCount("1.3*2"), 2);
  assert.equal(parseMoveLength(""), null);
  assert.equal(parseMoveLength("*3"), null);
  assert.equal(parseMoveLength("1."), 1);
  assert.equal(parseMoveLength("1.3*2"), 1.3);
  assert.equal(parseMoveLength("0"), null);
});

test("chip labels and badge", () => {
  assert.equal(formatMoveLengthBuffer(""), "—");
  assert.equal(formatMoveLengthBuffer("1.3*2"), "1.3");
  assert.equal(formatCopyCountBuffer("1.3"), "—");
  assert.equal(formatCopyCountBuffer("1.3*2"), "2");
  assert.equal(formatMoveBadge({ lengthM: 1.3, count: 0 }), "1.300 m");
  assert.equal(
    formatMoveBadge({ lengthM: 1.3, count: 2, axis: "Y" }),
    "Y 1.300 m ×2"
  );
});

test("scaleDeltaToLength keeps the direction", () => {
  const d2 = scaleDeltaToLength({ x: 3, y: 4 }, 10);
  assert.deepEqual(d2, { x: 6, y: 8 });
  const d3 = scaleDeltaToLength({ x: 0, y: 0, z: 2 }, 1);
  assert.deepEqual(d3, { x: 0, y: 0, z: 1 });
  assert.deepEqual(scaleDeltaToLength({ x: 0, y: 0 }, 1), { x: 0, y: 0 });
  assert.deepEqual(scaleDeltaToLength({ x: 3, y: 4 }, null), { x: 3, y: 4 });
});
