import assert from "node:assert/strict";
import { test } from "node:test";
import getScaledImageBbox from "./getScaledImageBbox.js";

const bbox = { x: 100, y: 50, width: 200, height: 100 };

test("factor 1 is the identity", () => {
  assert.deepEqual(getScaledImageBbox({ bboxPx: bbox, pivot: { x: 0, y: 0 }, factor: 1 }), bbox);
});

test("pivot at the centre keeps the centre", () => {
  const out = getScaledImageBbox({ bboxPx: bbox, pivot: { x: 200, y: 100 }, factor: 2 });
  assert.deepEqual(out, { x: 0, y: 0, width: 400, height: 200 });
});

test("pivot at a corner keeps that corner fixed", () => {
  const out = getScaledImageBbox({ bboxPx: bbox, pivot: { x: 100, y: 50 }, factor: 0.5 });
  assert.deepEqual(out, { x: 100, y: 50, width: 100, height: 50 });
});

test("missing pivot falls back to the centre", () => {
  const out = getScaledImageBbox({ bboxPx: bbox, factor: 0.5 });
  assert.deepEqual(out, { x: 150, y: 75, width: 100, height: 50 });
});
