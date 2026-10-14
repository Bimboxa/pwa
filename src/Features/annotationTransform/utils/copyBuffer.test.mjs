import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_COPIES,
  appendToMoveBuffer,
  appendToRotateBuffer,
  formatAngleValueBuffer,
  formatCopyCountBuffer,
  formatMoveBadge,
  formatMoveLengthBuffer,
  formatRotateBadge,
  getBufferCountPart,
  getBufferValuePart,
  parseCopyCount,
  parseMoveLength,
  parseTypedAngleDeg,
  scaleDeltaToLength,
  withCopyCountPart,
  withCopyCountText,
  withDefaultCopyCount,
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
  // A move distance is never negative.
  assert.equal(appendToMoveBuffer("", "-"), "");
});

test("rotate buffer: a leading minus only, then the same grammar", () => {
  assert.equal(appendToRotateBuffer("", "-"), "-");
  assert.equal(appendToRotateBuffer("-", "-"), "-");
  assert.equal(appendToRotateBuffer("1", "-"), "1");
  assert.equal(appendToRotateBuffer("-", "."), "-0.");
  assert.equal(appendToRotateBuffer("-", "3"), "-3");
  assert.equal(appendToRotateBuffer("-30", "*"), "-30*");
  assert.equal(appendToRotateBuffer("-30*", "2"), "-30*2");
  assert.equal(appendToRotateBuffer("-30*2", "-"), "-30*2");
  assert.equal(appendToRotateBuffer("4", "5"), "45");
  assert.equal(appendToRotateBuffer("45", "*"), "45*");
  assert.equal(appendToRotateBuffer("45*", "3"), "45*3");
  assert.equal(appendToRotateBuffer("", "*"), "*");
  assert.equal(appendToRotateBuffer("*", "3"), "*3");
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
  assert.equal(parseCopyCount("-30*2"), 2);
  assert.equal(parseMoveLength(""), null);
  assert.equal(parseMoveLength("*3"), null);
  assert.equal(parseMoveLength("1."), 1);
  assert.equal(parseMoveLength("1.3*2"), 1.3);
  assert.equal(parseMoveLength("0"), null);
});

test("parseTypedAngleDeg reads the signed angle part", () => {
  assert.equal(parseTypedAngleDeg(""), null);
  assert.equal(parseTypedAngleDeg(undefined), null);
  assert.equal(parseTypedAngleDeg("*3"), null);
  assert.equal(parseTypedAngleDeg("-"), null);
  assert.equal(parseTypedAngleDeg("0"), 0);
  assert.equal(parseTypedAngleDeg("45*3"), 45);
  assert.equal(parseTypedAngleDeg("-30"), -30);
  assert.equal(parseTypedAngleDeg("12,5"), 12.5);
  assert.equal(parseTypedAngleDeg("1."), 1);
});

test("chip labels and badges", () => {
  assert.equal(formatMoveLengthBuffer(""), "—");
  assert.equal(formatMoveLengthBuffer("1.3*2"), "1.3");
  assert.equal(formatCopyCountBuffer("1.3"), "—");
  assert.equal(formatCopyCountBuffer("1.3*2"), "2");
  assert.equal(formatAngleValueBuffer(""), "");
  assert.equal(formatAngleValueBuffer("-30*2"), "-30");
  assert.equal(formatAngleValueBuffer("*2"), "");
  assert.equal(formatMoveBadge({ lengthM: 1.3, count: 0 }), "1.300 m");
  assert.equal(
    formatMoveBadge({ lengthM: 1.3, count: 2, axis: "Y" }),
    "Y 1.300 m ×2"
  );
  assert.equal(formatRotateBadge({ angleLabel: "45°", count: 0 }), "45°");
  assert.equal(formatRotateBadge({ angleLabel: "45°", count: 3 }), "45° ×3");
  // « Recommencer à chaque clic »
  assert.equal(
    formatMoveBadge({ lengthM: 1.3, count: 1, repeat: true }),
    "1.300 m ×1 ↻"
  );
  assert.equal(formatMoveBadge({ count: 0, repeat: true }), "↻");
  assert.equal(
    formatRotateBadge({ angleLabel: "1.3 m", count: 1, repeat: true }),
    "1.3 m ×1 ↻"
  );
});

test("withDefaultCopyCount (« Copier ») asks for one copy unless some are typed", () => {
  assert.equal(withDefaultCopyCount(""), "*1");
  assert.equal(withDefaultCopyCount("*"), "*1");
  assert.equal(withDefaultCopyCount("*0"), "*1");
  assert.equal(withDefaultCopyCount("1.3"), "1.3*1");
  assert.equal(withDefaultCopyCount("1.3*3"), "1.3*3");
  assert.equal(withDefaultCopyCount("*4"), "*4");
  assert.equal(withDefaultCopyCount(undefined), "*1");
});

test("raw parts and the copy-count field", () => {
  assert.equal(getBufferValuePart("1.3*2"), "1.3");
  assert.equal(getBufferValuePart("*2"), "");
  assert.equal(getBufferCountPart("1.3*2"), "2");
  assert.equal(getBufferCountPart("1.3"), "");
  assert.equal(getBufferCountPart("1.3*"), "");
  assert.equal(withCopyCountText("3", "1.3"), "1.3*3");
  assert.equal(withCopyCountText("", "1.3*3"), "1.3");
  assert.equal(withCopyCountText("4a", "45"), "45*4");
  assert.equal(withCopyCountText("", ""), "");
  assert.equal(withCopyCountText("", "*3"), "");
  assert.equal(withCopyCountText("150", "45*3"), "45*3");
});

test("withCopyCountPart keeps the typed copies when the field edits the value", () => {
  assert.equal(withCopyCountPart("45", ""), "45");
  assert.equal(withCopyCountPart("45", "30*3"), "45*3");
  assert.equal(withCopyCountPart("", "30*3"), "*3");
  assert.equal(withCopyCountPart("4*5", "30*3"), "45*3");
});

test("scaleDeltaToLength keeps the direction", () => {
  const d2 = scaleDeltaToLength({ x: 3, y: 4 }, 10);
  assert.deepEqual(d2, { x: 6, y: 8 });
  const d3 = scaleDeltaToLength({ x: 0, y: 0, z: 2 }, 1);
  assert.deepEqual(d3, { x: 0, y: 0, z: 1 });
  assert.deepEqual(scaleDeltaToLength({ x: 0, y: 0 }, 1), { x: 0, y: 0 });
  assert.deepEqual(scaleDeltaToLength({ x: 3, y: 4 }, null), { x: 3, y: 4 });
});
