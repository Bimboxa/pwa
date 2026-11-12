import assert from "node:assert/strict";
import { test } from "node:test";

import getCutLineVisiblePoints from "./getCutLineVisiblePoints.js";

const pt = (id, flags = {}) => ({ id, ...flags });

// head: 0, 1 derived — drawn: 2, 3, 4 — tail: 5, 6 derived
const makeLine = (stops = {}) => [
  pt("h0", { derived: true, stop: !!stops.h0 }),
  pt("h1", { derived: true, stop: !!stops.h1 }),
  pt("d0", { stop: !!stops.d0 }),
  pt("d1", { stop: !!stops.d1 }),
  pt("d2", { stop: !!stops.d2 }),
  pt("t0", { derived: true, stop: !!stops.t0 }),
  pt("t1", { derived: true, stop: !!stops.t1 }),
];

const ids = (points) => points.map((p) => p.id);

test("no stop keeps the whole line", () => {
  const line = makeLine();
  const result = getCutLineVisiblePoints(line);
  assert.equal(result.startIndex, 0);
  assert.equal(result.endIndex, 6);
  assert.deepEqual(ids(result.points), ids(line));
});

test("a stop in the derived head truncates the start (stop included)", () => {
  const result = getCutLineVisiblePoints(makeLine({ h1: true }));
  assert.equal(result.startIndex, 1);
  assert.equal(result.endIndex, 6);
  assert.deepEqual(ids(result.points), ["h1", "d0", "d1", "d2", "t0", "t1"]);
});

test("a stop in the derived tail truncates the end (stop included)", () => {
  const result = getCutLineVisiblePoints(makeLine({ t0: true }));
  assert.equal(result.startIndex, 0);
  assert.equal(result.endIndex, 5);
  assert.deepEqual(ids(result.points), ["h0", "h1", "d0", "d1", "d2", "t0"]);
});

test("a stop on a drawn point truncates the end", () => {
  const result = getCutLineVisiblePoints(makeLine({ d1: true }));
  assert.equal(result.startIndex, 0);
  assert.equal(result.endIndex, 3);
  assert.deepEqual(ids(result.points), ["h0", "h1", "d0", "d1"]);
});

test("a stop on the first drawn point hides the head extension", () => {
  const result = getCutLineVisiblePoints(makeLine({ d0: true }));
  assert.equal(result.startIndex, 2);
  assert.equal(result.endIndex, 6);
  const both = getCutLineVisiblePoints(makeLine({ d0: true, d2: true }));
  assert.deepEqual(ids(both.points), ["d0", "d1", "d2"]);
  // Without a head the stop changes nothing (never a one-point line).
  const noHead = getCutLineVisiblePoints([
    pt("a", { stop: true }),
    pt("b"),
    pt("c"),
  ]);
  assert.deepEqual(ids(noHead.points), ["a", "b", "c"]);
});

test("stops on both sides combine", () => {
  const result = getCutLineVisiblePoints(makeLine({ h0: true, t1: true }));
  assert.equal(result.startIndex, 0);
  assert.equal(result.endIndex, 6);
  const inner = getCutLineVisiblePoints(makeLine({ h1: true, t0: true }));
  assert.equal(inner.startIndex, 1);
  assert.equal(inner.endIndex, 5);
  assert.deepEqual(ids(inner.points), ["h1", "d0", "d1", "d2", "t0"]);
});

test("with several stops the one closest to the drawn points wins", () => {
  const head = getCutLineVisiblePoints(makeLine({ h0: true, h1: true }));
  assert.equal(head.startIndex, 1);
  const tail = getCutLineVisiblePoints(makeLine({ t0: true, t1: true }));
  assert.equal(tail.endIndex, 5);
  const mixed = getCutLineVisiblePoints(makeLine({ d2: true, t1: true }));
  assert.equal(mixed.endIndex, 4);
});

test("a line without derived points only truncates its end", () => {
  const line = [pt("a"), pt("b", { stop: true }), pt("c")];
  const result = getCutLineVisiblePoints(line);
  assert.equal(result.startIndex, 0);
  assert.equal(result.endIndex, 1);
  assert.deepEqual(ids(result.points), ["a", "b"]);
});

test("an empty line gives no points", () => {
  assert.deepEqual(getCutLineVisiblePoints([]), {
    points: [],
    startIndex: -1,
    endIndex: -1,
  });
  assert.deepEqual(getCutLineVisiblePoints(null), {
    points: [],
    startIndex: -1,
    endIndex: -1,
  });
});
