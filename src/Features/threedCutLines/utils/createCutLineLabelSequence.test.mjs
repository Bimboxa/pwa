import assert from "node:assert/strict";
import { test } from "node:test";

import createCutLineLabelSequence from "./createCutLineLabelSequence.js";

test("starts at L-01 without any cut line", () => {
  const next = createCutLineLabelSequence([]);
  assert.equal(next(), "L-01");
  assert.equal(next(), "L-02");
});

test("continues after the highest existing number", () => {
  const next = createCutLineLabelSequence(["L-01", "L-04", "L-02"]);
  assert.equal(next(), "L-05");
  assert.equal(next(), "L-06");
});

test("ignores missing labels and labels of another form", () => {
  const next = createCutLineLabelSequence([
    undefined,
    null,
    "Ligne de coupe",
    "M-12",
    "L-3b",
    "L-03",
  ]);
  assert.equal(next(), "L-04");
});

test("keeps counting past two digits", () => {
  const next = createCutLineLabelSequence(["L-99"]);
  assert.equal(next(), "L-100");
});

test("does not mutate the labels it is given", () => {
  const labels = ["L-01"];
  createCutLineLabelSequence(labels)();
  assert.deepEqual(labels, ["L-01"]);
});
