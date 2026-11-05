import assert from "node:assert/strict";
import { test } from "node:test";

import getPrismSideSegments from "./getPrismSideSegments.js";
import getBreakSegmentLabels from "./getBreakSegmentLabels.js";

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

// 0 → 1 → 2 aligned on the bottom side.
const withMidVertex = (extra = {}) => [
  { x: 0, y: 0 },
  { x: 4, y: 0, ...extra },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

test("a ring without break is all plain", () => {
  const sides = getPrismSideSegments(square);
  assert.equal(sides.points.length, 4);
  assert.deepEqual(sides.labels, [0, 0, 0, 0]);
  assert.equal(sides.hidden.size, 0);
  assert.equal(sides.hasLabels, false);
  assert.deepEqual(sides.breakPoints, []);
});

test("an aligned vertex without the flag splits nothing", () => {
  const sides = getPrismSideSegments(withMidVertex());
  assert.deepEqual(sides.labels, [0, 0, 0, 0, 0]);
  assert.equal(sides.hasLabels, false);
  assert.deepEqual(sides.breakPoints, []);
});

test("a single break on a straight side splits it in two faces", () => {
  const sides = getPrismSideSegments(withMidVertex({ isBreak: true }));
  // Runs: from the break (1) to the sharpest other corner, and back.
  assert.notEqual(sides.labels[0], sides.labels[1]);
  assert.equal(sides.hasLabels, true);
  assert.equal(sides.breakPoints.length, 1);
  assert.equal(sides.breakPoints[0].index, 1);
  assert.ok(sides.breakPoints[0].foldDeg < 1e-6);
});

test("two breaks: one label per run between them", () => {
  const ring = [
    { x: 0, y: 0 },
    { x: 3, y: 0, isBreak: true },
    { x: 6, y: 0, isBreak: true },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const sides = getPrismSideSegments(ring);
  // Segment 1 (3 → 6) is alone in its run; the rest of the ring is the other.
  assert.deepEqual(sides.labels, [0, 1, 0, 0, 0, 0]);
  assert.deepEqual(
    sides.breakPoints.map((b) => b.index),
    [1, 2]
  );
});

test("a break on a gentle fold splits it too", () => {
  // ~5.7° fold at point 1.
  const ring = [
    { x: 0, y: 0 },
    { x: 5, y: 0, isBreak: true },
    { x: 10, y: 0.5 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const sides = getPrismSideSegments(ring);
  assert.notEqual(sides.labels[0], sides.labels[1]);
  assert.ok(Math.abs(sides.breakPoints[0].foldDeg - 5.71) < 0.01);
});

test("hidden segments: no edge on a break next to a hidden face", () => {
  const sides = getPrismSideSegments(withMidVertex({ isBreak: true }), [1, 3]);
  assert.deepEqual([...sides.hidden].sort(), [1, 3]);
  assert.notEqual(sides.labels[0], sides.labels[1]);
  assert.deepEqual(sides.breakPoints, []);
});

test("an arc is one face, hidden as a whole", () => {
  // Half circle bulging to the right between (10, 0) and (10, 10).
  const ring = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 15, y: 5, type: "circle" },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const sides = getPrismSideSegments(ring, [2], { samples: 4 });
  // 4 source anchors + 7 arc samples.
  assert.equal(sides.points.length, 11);
  assert.equal(sides.labels.length, 11);
  assert.equal(sides.hasLabels, false);
  // Source segment 2 is the second half of the arc: the 8 arc segments
  // (expanded 1 → 8) are hidden together.
  assert.deepEqual(
    [...sides.hidden].sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8]
  );
});

test("open line: breaks at the ends are ignored", () => {
  const line = [
    { x: 0, y: 0, isBreak: true },
    { x: 5, y: 0, isBreak: true },
    { x: 10, y: 0 },
    { x: 10, y: 5, isBreak: true },
  ];
  const result = getBreakSegmentLabels(line, { closed: false });
  assert.deepEqual(result.labels, [0, 1, 1]);
  assert.deepEqual(result.breaks, [1]);
  assert.equal(result.hasLabels, true);
});

test("open line without interior break: one face", () => {
  const line = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 10, y: 0 },
  ];
  const result = getBreakSegmentLabels(line, { closed: false });
  assert.deepEqual(result.labels, [0, 0]);
  assert.equal(result.hasLabels, false);
});
