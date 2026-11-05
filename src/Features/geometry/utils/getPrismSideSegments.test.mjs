import assert from "node:assert/strict";
import { test } from "node:test";

import getPrismSideSegments from "./getPrismSideSegments.js";

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

test("a ring without aligned vertex is all plain", () => {
  const sides = getPrismSideSegments(square);
  assert.equal(sides.points.length, 4);
  assert.deepEqual(sides.labels, [0, 0, 0, 0]);
  assert.equal(sides.hidden.size, 0);
  assert.equal(sides.hasLabels, false);
  assert.deepEqual(sides.vertexEdges, []);
});

test("a vertex in the middle of a straight side splits it in two faces", () => {
  // 0 → 1 → 2 aligned on the bottom side.
  const ring = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const sides = getPrismSideSegments(ring);
  assert.deepEqual(sides.labels, [0, 1, 0, 0, 0]);
  assert.equal(sides.hasLabels, true);
  assert.deepEqual(sides.vertexEdges, [1]);
});

test("a run of aligned segments straddling the ring closure", () => {
  // The ring starts in the middle of the left side: 4 → 0 → 1 aligned.
  const ring = [
    { x: 0, y: 5 },
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const sides = getPrismSideSegments(ring);
  // Left side: segment 4 (0,10 → 0,5) then segment 0 (0,5 → 0,0).
  assert.deepEqual(sides.labels, [1, 0, 0, 0, 0]);
  assert.deepEqual(sides.vertexEdges, [0]);
});

test("three aligned segments get three labels", () => {
  const ring = [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 6, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const sides = getPrismSideSegments(ring);
  assert.deepEqual(sides.labels, [0, 1, 2, 0, 0, 0]);
  assert.deepEqual(sides.vertexEdges, [1, 2]);
});

test("hidden segments: no vertex edge next to a hidden face", () => {
  const ring = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const sides = getPrismSideSegments(ring, [1, 3]);
  assert.deepEqual([...sides.hidden].sort(), [1, 3]);
  assert.deepEqual(sides.labels, [0, 1, 0, 0, 0]);
  assert.deepEqual(sides.vertexEdges, []);
});

test("a gentle fold gets a vertex edge but no label", () => {
  // ~5.7° fold at point 1.
  const ring = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 10, y: 0.5 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const sides = getPrismSideSegments(ring);
  assert.equal(sides.hasLabels, false);
  assert.deepEqual(sides.vertexEdges, [1]);
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
  // The arc ends are no straight junctions: no vertex edge.
  assert.deepEqual(sides.vertexEdges, []);
});
