import assert from "node:assert/strict";
import { test } from "node:test";

import insertCutLineCrossings, {
  isPointOnLines,
} from "./insertCutLineCrossings.js";

const v = (x, y, z = 0) => ({ x, y, z });

// Line along +y: head extension 0 → 2, drawn 2 → 4 → 6, tail extension → 10.
const makeLine = () => ({
  points: [v(5, 0), v(5, 2), v(5, 4), v(5, 6), v(5, 10)],
  derivedStart: 1,
  derivedEnd: 1,
});

const close = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < 1e-9;

test("no other line leaves the line untouched", () => {
  const line = makeLine();
  const result = insertCutLineCrossings({ ...line, otherLines: [] });
  assert.equal(result.points, line.points);
  assert.equal(result.derivedStart, 1);
  assert.equal(result.derivedEnd, 1);
});

test("a line crossed by the tail extension adds one derived point", () => {
  const result = insertCutLineCrossings({
    ...makeLine(),
    otherLines: [[v(0, 8), v(10, 8)]],
  });
  assert.equal(result.points.length, 6);
  assert.ok(close(result.points[4], v(5, 8)));
  assert.equal(result.derivedStart, 1);
  assert.equal(result.derivedEnd, 2);
});

test("a line crossed by the head extension adds one derived point", () => {
  const result = insertCutLineCrossings({
    ...makeLine(),
    otherLines: [[v(0, 1), v(10, 1)]],
  });
  assert.equal(result.points.length, 6);
  assert.ok(close(result.points[1], v(5, 1)));
  assert.equal(result.derivedStart, 2);
  assert.equal(result.derivedEnd, 1);
});

test("several crossings of one segment are inserted in line order", () => {
  const result = insertCutLineCrossings({
    ...makeLine(),
    otherLines: [
      [v(0, 9), v(10, 9)],
      [v(0, 7), v(10, 7)],
    ],
  });
  assert.deepEqual(
    result.points.map((p) => p.y),
    [0, 2, 4, 6, 7, 9, 10]
  );
  assert.equal(result.derivedEnd, 3);
});

test("a crossing on a vertex of the other line gives a single point", () => {
  const result = insertCutLineCrossings({
    ...makeLine(),
    otherLines: [[v(0, 8), v(5, 8), v(10, 9)]],
  });
  assert.equal(result.points.length, 6);
  assert.ok(close(result.points[4], v(5, 8)));
});

test("a crossing on an existing vertex of the line adds nothing", () => {
  const line = makeLine();
  const result = insertCutLineCrossings({
    ...line,
    otherLines: [
      [v(0, 10), v(10, 10)],
      [v(0, 6), v(10, 6)],
    ],
  });
  assert.equal(result.points, line.points);
});

test("the drawn segments are not split", () => {
  const line = makeLine();
  const result = insertCutLineCrossings({
    ...line,
    otherLines: [
      [v(0, 3), v(10, 3)],
      [v(0, 5), v(10, 5)],
    ],
  });
  assert.equal(result.points, line.points);
});

test("a line passing above the extension is not a crossing", () => {
  const line = makeLine();
  const result = insertCutLineCrossings({
    ...line,
    otherLines: [[v(0, 8, 0.5), v(10, 8, 0.5)]],
  });
  assert.equal(result.points, line.points);
});

test("the inserted point lies on the other line (within the tolerance)", () => {
  const result = insertCutLineCrossings({
    ...makeLine(),
    otherLines: [[v(0, 8, 0.002), v(10, 8, 0.002)]],
  });
  assert.ok(close(result.points[4], v(5, 8, 0.002)));
});

test("a line running along the extension does not cross it", () => {
  const line = makeLine();
  const result = insertCutLineCrossings({
    ...line,
    otherLines: [[v(5, 7), v(5, 9)]],
  });
  assert.equal(result.points, line.points);
});

test("a line ending on the extension adds its end point", () => {
  const result = insertCutLineCrossings({
    ...makeLine(),
    otherLines: [[v(0, 8), v(5, 8)]],
  });
  assert.equal(result.points.length, 6);
  assert.ok(close(result.points[4], v(5, 8)));
});

test("isPointOnLines: on a segment, on a vertex, off the line", () => {
  const lines = [[v(0, 8), v(5, 8), v(10, 9)]];
  assert.equal(isPointOnLines(v(2, 8.003), lines), true);
  assert.equal(isPointOnLines(v(5, 8), lines), true);
  assert.equal(isPointOnLines(v(2, 8.02), lines), false);
  assert.equal(isPointOnLines(v(-1, 8), lines), false);
  assert.equal(isPointOnLines(v(2, 8), []), false);
});
