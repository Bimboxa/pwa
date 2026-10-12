import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_COPIES,
  appendToCopyBuffer,
  formatCopyBuffer,
  parseCopyCount,
} from "./copyBuffer.js";

test("x starts the buffer, digits follow, anything else is ignored", () => {
  assert.equal(appendToCopyBuffer("", "3"), "");
  assert.equal(appendToCopyBuffer("", "x"), "x");
  assert.equal(appendToCopyBuffer("", "X"), "x");
  assert.equal(appendToCopyBuffer("x", "3"), "x3");
  assert.equal(appendToCopyBuffer("x3", "0"), "x30");
  assert.equal(appendToCopyBuffer("x3", "."), "x3");
  assert.equal(appendToCopyBuffer("x3", "x"), "x");
});

test("the count is capped", () => {
  assert.equal(appendToCopyBuffer("x99", "9"), "x99");
  assert.equal(parseCopyCount(`x${MAX_COPIES + 50}`), MAX_COPIES);
});

test("parseCopyCount reads the typed count, 0 otherwise", () => {
  assert.equal(parseCopyCount(""), 0);
  assert.equal(parseCopyCount(undefined), 0);
  assert.equal(parseCopyCount("x"), 0);
  assert.equal(parseCopyCount("x0"), 0);
  assert.equal(parseCopyCount("x1"), 1);
  assert.equal(parseCopyCount("x12"), 12);
  assert.equal(parseCopyCount("3"), 0);
});

test("formatCopyBuffer", () => {
  assert.equal(formatCopyBuffer(""), "—");
  assert.equal(formatCopyBuffer("x3"), "x3");
});
