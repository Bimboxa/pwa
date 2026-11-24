import test from "node:test";
import assert from "node:assert/strict";

import resolveAnnotationPhaseIndexes from "./resolveAnnotationPhaseIndexes.js";
import encodePhaseRels from "./encodePhaseRels.js";
import getPhaseIndexesAfterClick from "./getPhaseIndexesAfterClick.js";
import filterPhaseHiddenAnnotations from "./filterPhaseHiddenAnnotations.js";
import sortPhases from "./sortPhases.js";
import getNewAnnotationPhaseIndexes from "./getNewAnnotationPhaseIndexes.js";

const phases = ["p1", "p2", "p3", "p4", "p5"].map((id) => ({ id }));
const list = (set) => [...set].sort((a, b) => a - b);

test("no rel = every phase", () => {
  assert.deepEqual(
    list(resolveAnnotationPhaseIndexes([], phases)),
    [0, 1, 2, 3, 4]
  );
});

test("START only runs to the last phase", () => {
  const rels = [{ phaseId: "p3", type: "START" }];
  assert.deepEqual(
    list(resolveAnnotationPhaseIndexes(rels, phases)),
    [2, 3, 4]
  );
  // ...the phases added later included
  assert.deepEqual(
    list(resolveAnnotationPhaseIndexes(rels, [...phases, { id: "p6" }])),
    [2, 3, 4, 5]
  );
});

test("START / END / EXCLUDE, swapped bounds, deleted phase", () => {
  const rels = [
    { phaseId: "p4", type: "START" },
    { phaseId: "p1", type: "END" },
    { phaseId: "p2", type: "EXCLUDE" },
    { phaseId: "gone", type: "EXCLUDE" },
  ];
  assert.deepEqual(
    list(resolveAnnotationPhaseIndexes(rels, phases)),
    [0, 2, 3]
  );
});

test("encode is the inverse of resolve", () => {
  for (const indexes of [[0, 1, 2, 3, 4], [2], [0, 2], [1, 2, 4], [3, 4]]) {
    const rows = encodePhaseRels(indexes, phases);
    assert.deepEqual(
      list(resolveAnnotationPhaseIndexes(rows, phases)),
      indexes
    );
  }
  assert.deepEqual(encodePhaseRels([0, 1, 2, 3, 4], phases), []);
  assert.deepEqual(encodePhaseRels([2, 3, 4], phases), [
    { phaseId: "p3", type: "START" },
  ]);
  assert.equal(encodePhaseRels([], phases), null);
});

test("click moves a bound of the period", () => {
  const current = new Set([1, 2, 3]);
  assert.deepEqual(list(getPhaseIndexesAfterClick(current, 0)), [0, 1, 2, 3]);
  assert.deepEqual(list(getPhaseIndexesAfterClick(current, 4)), [1, 2, 3, 4]);
  assert.deepEqual(list(getPhaseIndexesAfterClick(current, 1)), [1]);
  assert.deepEqual(list(getPhaseIndexesAfterClick(current, 3)), [3]);
  assert.deepEqual(
    list(getPhaseIndexesAfterClick(new Set([0, 1, 2, 3, 4]), 1)),
    [1, 2, 3, 4]
  );
  assert.deepEqual(
    list(getPhaseIndexesAfterClick(new Set([0, 1, 2, 3, 4]), 3)),
    [0, 1, 2, 3]
  );
});

test("click keeps the holes inside the new period", () => {
  assert.deepEqual(
    list(getPhaseIndexesAfterClick(new Set([1, 3]), 4)),
    [1, 3, 4]
  );
  // clicking a hole fills it
  assert.deepEqual(
    list(getPhaseIndexesAfterClick(new Set([0, 2, 4]), 1)),
    [1, 2, 4]
  );
});

test("filter keeps base map annotations and references", () => {
  const annotations = [
    { id: "a" },
    { id: "b" },
    { id: "c", isBaseMapAnnotation: true },
  ];
  assert.equal(
    filterPhaseHiddenAnnotations(annotations, new Set()),
    annotations
  );
  assert.equal(
    filterPhaseHiddenAnnotations(annotations, new Set(["x"])),
    annotations
  );
  assert.deepEqual(
    filterPhaseHiddenAnnotations(annotations, new Set(["b", "c"])).map(
      (a) => a.id
    ),
    ["a", "c"]
  );
});

test("sortPhases orders by sortIndex and drops deleted rows", () => {
  assert.deepEqual(
    sortPhases([
      { id: "b", sortIndex: "a1" },
      { id: "x", sortIndex: "a0V", deletedAt: "2026" },
      { id: "a", sortIndex: "a0" },
    ]).map((p) => p.id),
    ["a", "b"]
  );
});

test("new annotation: one phase only / and after, several as selected", () => {
  assert.deepEqual(getNewAnnotationPhaseIndexes([2], 5, "FROM"), [2, 3, 4]);
  assert.deepEqual(getNewAnnotationPhaseIndexes([2], 5, undefined), [2, 3, 4]);
  assert.deepEqual(getNewAnnotationPhaseIndexes([2], 5, "ONLY"), [2]);
  assert.deepEqual(getNewAnnotationPhaseIndexes([3, 0], 5, "FROM"), [0, 3]);
  assert.deepEqual(getNewAnnotationPhaseIndexes([], 5, "FROM"), []);
  // "and after" stays open-ended: no END row
  assert.deepEqual(
    encodePhaseRels(getNewAnnotationPhaseIndexes([2], 5, "FROM"), phases),
    [{ phaseId: "p3", type: "START" }]
  );
});
