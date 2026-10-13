import test from "node:test";
import assert from "node:assert/strict";

import preferLineHits, { getLineWinTolerance } from "./preferLineHits.js";

const root = { userData: { nodeId: "A" } };
const face = (distance) => ({
  distance,
  object: { isMesh: true, userData: {}, parent: root },
});
const line = (distance, parent = root) => ({
  distance,
  object: { isMesh: true, isLine2: true, userData: {}, parent },
});

test("a line slightly behind the face under the cursor wins", () => {
  const f = face(10);
  const l = line(10 + getLineWinTolerance(10) / 2);
  const out = preferLineHits([f, l]);
  assert.equal(out[0], l);
  assert.equal(out[1], f);
});

test("a line beyond the tolerance stays behind", () => {
  const f = face(10);
  const l = line(10 + getLineWinTolerance(10) * 1.5);
  const out = preferLineHits([f, l]);
  assert.equal(out.length, 2);
  assert.equal(out[0], f);
});

test("a line already first is left alone, input never mutated", () => {
  const l = line(5);
  const f = face(6);
  const input = [l, f];
  const out = preferLineHits(input);
  assert.equal(out, input);
  assert.deepEqual(input, [l, f]);
});

test("a line without annotation root never wins", () => {
  const f = face(10);
  const orphan = line(10, null);
  const out = preferLineHits([f, orphan]);
  assert.equal(out[0], f);
});

test("tolerance grows with the distance and has a floor", () => {
  assert.ok(getLineWinTolerance(0) > 0);
  assert.ok(getLineWinTolerance(100) > getLineWinTolerance(1));
});
