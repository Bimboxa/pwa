import test from "node:test";
import assert from "node:assert/strict";

import isolatePolylineSegment from "./isolatePolylineSegment.js";
import partitionSegmentFlagIds from "./partitionSegmentFlagIds.js";

const pts = (ids) => ids.map((id) => ({ id }));
const ids = (piece) => piece?.points.map((p) => p.id) ?? null;

test("open polyline, middle segment → 3 pieces sharing the cut vertices", () => {
  const r = isolatePolylineSegment(pts(["a", "b", "c", "d", "e"]), 2, false);
  assert.deepEqual(ids(r.before), ["a", "b", "c"]);
  assert.deepEqual(ids(r.isolated), ["c", "d"]);
  assert.deepEqual(ids(r.after), ["d", "e"]);
  assert.deepEqual(r.isolated.indices, [2, 3]);
});

test("open polyline, first / last segment → 2 pieces", () => {
  const first = isolatePolylineSegment(pts(["a", "b", "c", "d"]), 0, false);
  assert.equal(first.before, null);
  assert.deepEqual(ids(first.isolated), ["a", "b"]);
  assert.deepEqual(ids(first.after), ["b", "c", "d"]);

  const last = isolatePolylineSegment(pts(["a", "b", "c", "d"]), 2, false);
  assert.deepEqual(ids(last.before), ["a", "b", "c"]);
  assert.deepEqual(ids(last.isolated), ["c", "d"]);
  assert.equal(last.after, null);
});

test("2-point open polyline → nothing to split", () => {
  const r = isolatePolylineSegment(pts(["a", "b"]), 0, false);
  assert.deepEqual(ids(r.isolated), ["a", "b"]);
  assert.equal(r.before, null);
  assert.equal(r.after, null);
});

test("out of range / degenerate → null", () => {
  assert.equal(isolatePolylineSegment(pts(["a", "b", "c"]), 2, false), null);
  assert.equal(isolatePolylineSegment(pts(["a", "b", "c"]), -1, false), null);
  assert.equal(isolatePolylineSegment(pts(["a"]), 0, false), null);
  assert.equal(isolatePolylineSegment(pts(["a", "b"]), 0, true), null);
});

test("closed ring → the segment + the rest, both open, sharing 2 vertices", () => {
  const r = isolatePolylineSegment(pts(["a", "b", "c", "d"]), 1, true);
  assert.deepEqual(ids(r.isolated), ["b", "c"]);
  assert.equal(r.before, null);
  assert.deepEqual(ids(r.after), ["c", "d", "a", "b"]);
  assert.deepEqual(r.after.indices, [2, 3, 0, 1]);
});

test("closed ring, closing segment (n-1 → 0)", () => {
  const r = isolatePolylineSegment(pts(["a", "b", "c", "d"]), 3, true);
  assert.deepEqual(ids(r.isolated), ["d", "a"]);
  assert.deepEqual(ids(r.after), ["a", "b", "c", "d"]);
});

test("arc S-C-S: the clicked half widens to the whole arc", () => {
  const points = [
    { id: "a" },
    { id: "b" },
    { id: "c", type: "circle" },
    { id: "d" },
    { id: "e" },
  ];
  // first half (b → c) and second half (c → d) both isolate b-c-d
  for (const k of [1, 2]) {
    const r = isolatePolylineSegment(points, k, false);
    assert.deepEqual(ids(r.before), ["a", "b"]);
    assert.deepEqual(ids(r.isolated), ["b", "c", "d"]);
    assert.deepEqual(ids(r.after), ["d", "e"]);
  }
});

test("arc on a closed ring wraps", () => {
  const points = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
    { id: "d", type: "circle" },
  ];
  // closing arc c → d(circle) → a
  const r = isolatePolylineSegment(points, 2, true);
  assert.deepEqual(ids(r.isolated), ["c", "d", "a"]);
  assert.deepEqual(ids(r.after), ["a", "b", "c"]);
});

test("segment flags follow the piece owning the start point (not its last slot)", () => {
  const raw = pts(["a", "b", "c", "d", "e"]);
  const r = isolatePolylineSegment(raw, 2, false);
  const parts = partitionSegmentFlagIds(
    { hiddenSegmentsPointIds: ["a", "b", "c", "d"] },
    raw,
    { before: r.before, isolated: r.isolated, after: r.after }
  );
  assert.deepEqual(parts.before.hiddenSegmentsPointIds, ["a", "b"]);
  assert.deepEqual(parts.isolated.hiddenSegmentsPointIds, ["c"]);
  assert.deepEqual(parts.after.hiddenSegmentsPointIds, ["d"]);
});

test("segment flags on a closed ring rest piece", () => {
  const raw = pts(["a", "b", "c", "d"]);
  const r = isolatePolylineSegment(raw, 1, true);
  const parts = partitionSegmentFlagIds(
    { hiddenSegmentsPointIds: ["a", "b", "c", "d"] },
    raw,
    { isolated: r.isolated, after: r.after, before: null }
  );
  assert.deepEqual(parts.isolated.hiddenSegmentsPointIds, ["b"]);
  assert.deepEqual(parts.after.hiddenSegmentsPointIds, ["a", "c", "d"]);
  assert.equal(parts.before, undefined);
});
