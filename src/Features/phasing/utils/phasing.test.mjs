import test from "node:test";
import assert from "node:assert/strict";

import resolveAnnotationPhaseIndexes from "./resolveAnnotationPhaseIndexes.js";
import encodePhaseRels from "./encodePhaseRels.js";
import getPhaseIndexesAfterClick from "./getPhaseIndexesAfterClick.js";
import filterPhaseHiddenAnnotations from "./filterPhaseHiddenAnnotations.js";
import sortPhases from "./sortPhases.js";
import getNewAnnotationPhaseIndexes from "./getNewAnnotationPhaseIndexes.js";
import getPhaseNewAnnotationIds from "./getPhaseNewAnnotationIds.js";

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

test("click = that phase only, again on the only phase = every phase", () => {
  const options = { phasesCount: 5 };
  const current = new Set([1, 2, 3]);
  assert.deepEqual(list(getPhaseIndexesAfterClick(current, 2, options)), [2]);
  assert.deepEqual(list(getPhaseIndexesAfterClick(current, 4, options)), [4]);
  assert.deepEqual(
    list(getPhaseIndexesAfterClick(new Set([2]), 2, options)),
    [0, 1, 2, 3, 4]
  );
  // the input is left untouched
  assert.deepEqual(list(current), [1, 2, 3]);
});

test("shift click adds / removes that phase", () => {
  const options = { additive: true, phasesCount: 5 };
  const current = new Set([1, 2, 3]);
  assert.deepEqual(
    list(getPhaseIndexesAfterClick(current, 2, options)),
    [1, 3]
  );
  assert.deepEqual(
    list(getPhaseIndexesAfterClick(new Set([1, 3]), 2, options)),
    [1, 2, 3]
  );
  assert.deepEqual(
    list(getPhaseIndexesAfterClick(current, 4, options)),
    [1, 2, 3, 4]
  );
  // removing the only phase: every phase
  assert.deepEqual(
    list(getPhaseIndexesAfterClick(new Set([2]), 2, options)),
    [0, 1, 2, 3, 4]
  );
  // forced direction (multi-selection)
  assert.deepEqual(
    list(getPhaseIndexesAfterClick(current, 2, { ...options, remove: false })),
    [1, 2, 3]
  );
  assert.deepEqual(list(current), [1, 2, 3]);
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

test("new annotation: exactly the selected phases", () => {
  assert.deepEqual(getNewAnnotationPhaseIndexes([2]), [2]);
  assert.deepEqual(getNewAnnotationPhaseIndexes([3, 0, 3]), [0, 3]);
  assert.deepEqual(getNewAnnotationPhaseIndexes([]), []);
  // "phase 3 and after" selected in the strip stays open-ended: no END row
  assert.deepEqual(
    encodePhaseRels(getNewAnnotationPhaseIndexes([4, 2, 3]), phases),
    [{ phaseId: "p3", type: "START" }]
  );
});

test("new annotations of the displayed phases", () => {
  const rels = [
    // a: phase 1 and after — old in phase 3
    { annotationId: "a", phaseId: "p1", type: "START" },
    // b: phase 3 and after — new in phase 3
    { annotationId: "b", phaseId: "p3", type: "START" },
    // c: phases 2 to 3 — old in phase 3
    { annotationId: "c", phaseId: "p2", type: "START" },
    { annotationId: "c", phaseId: "p3", type: "END" },
    // d: phase 4 and after — new once phases 3+ are displayed
    { annotationId: "d", phaseId: "p4", type: "START" },
  ];
  assert.deepEqual(getPhaseNewAnnotationIds(rels, phases, ["p3"]), ["b", "d"]);
  assert.deepEqual(getPhaseNewAnnotationIds(rels, phases, ["p4", "p2"]), [
    "b",
    "c",
    "d",
  ]);
  // nothing can be old: no displayed phase, or the first one is displayed
  assert.equal(getPhaseNewAnnotationIds(rels, phases, []), null);
  assert.equal(getPhaseNewAnnotationIds(rels, phases, ["p1", "p3"]), null);
});
