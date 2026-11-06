import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSegmentFlagChanges,
  SEGMENT_FLAG_FIELDS,
  segmentIdxToPointIds,
  segmentPointIdsToIdx,
} from "./segmentFlags.js";

const ring = (ids) => ids.map((id) => ({ id }));

test("an id repeated consecutively maps to its plan segment, not the vertical one", () => {
  // A→A vertical (0), A→Q (1), Q→Q vertical (2), Q→R (3)
  const points = ring(["A", "A", "Q", "Q", "R"]);
  assert.deepEqual(segmentPointIdsToIdx(["A"], points), [1]);
  assert.deepEqual(segmentPointIdsToIdx(["Q"], points), [3]);
});

test("a vertical segment at the end of an open path keeps its start", () => {
  // P→A (0), A→A vertical (1): the last A starts no segment.
  assert.deepEqual(segmentPointIdsToIdx(["A"], ring(["P", "A", "A"])), [1]);
});

test("plain rings are unchanged", () => {
  const points = ring(["A", "B", "C"]);
  assert.deepEqual(segmentPointIdsToIdx(["B", "A"], points), [0, 1]);
  assert.deepEqual(segmentPointIdsToIdx(["C"], points), []);
  assert.deepEqual(segmentPointIdsToIdx(["C"], points, { closed: true }), [2]);
});

test("flat-extrusion flag is registered and written as start point ids", () => {
  assert.ok(
    SEGMENT_FLAG_FIELDS.some(
      (f) =>
        f.idxField === "isFlatExtrusionSegmentsIdx" &&
        f.idField === "isFlatExtrusionSegmentsPointIds"
    )
  );
  const points = ring(["A", "B", "C", "D"]);
  const record = { id: "ann", type: "POLYLINE", points };
  const set = buildSegmentFlagChanges({
    record,
    resolvedAnnotation: { points },
    ops: [
      {
        idxField: "isFlatExtrusionSegmentsIdx",
        ringKey: "MAIN",
        segIdxs: [1],
        mode: "set",
      },
    ],
  });
  assert.deepEqual(set, { isFlatExtrusionSegmentsPointIds: ["B"] });
  const removed = buildSegmentFlagChanges({
    record: { ...record, ...set },
    resolvedAnnotation: { points },
    ops: [
      {
        idxField: "isFlatExtrusionSegmentsIdx",
        ringKey: "MAIN",
        segIdxs: [1],
        mode: "remove",
      },
    ],
  });
  assert.deepEqual(removed, { isFlatExtrusionSegmentsPointIds: [] });
});

test("flags carry over by ring position onto a re-copied ring", () => {
  // Sweep refresh: same vertex count, brand-new point ids.
  const before = ring(["A", "B", "C", "D"]);
  const after = ring(["a", "b", "c", "d"]);
  assert.deepEqual(
    segmentIdxToPointIds(segmentPointIdsToIdx(["B", "C"], before), after),
    ["b", "c"]
  );
});
