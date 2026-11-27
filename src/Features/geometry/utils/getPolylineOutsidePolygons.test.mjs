import assert from "node:assert/strict";
import { test } from "node:test";

import getPolylineOutsidePolygons from "./getPolylineOutsidePolygons.js";

const rect = (x0, y0, x1, y1) => [
  [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ],
];

const line = [
  { id: "a", x: 0, y: 0 },
  { id: "b", x: 100, y: 0 },
];

const xs = (chain) => chain.points.map((p) => p.x);

test("no polygon on the path removes nothing", () => {
  assert.equal(getPolylineOutsidePolygons(line, [rect(10, 5, 20, 15)]), null);
});

test("one footprint across the path leaves two chains", () => {
  const res = getPolylineOutsidePolygons(line, [rect(40, -5, 60, 5)]);
  assert.equal(res.consumed, false);
  assert.deepEqual(res.chains.map(xs), [
    [0, 40],
    [60, 100],
  ]);
  // original vertices keep their id, cut points have none
  assert.equal(res.chains[0].points[0].id, "a");
  assert.equal(res.chains[0].points[1].id, undefined);
  assert.equal(res.chains[0].points[1].srcSegIdx, 0);
  assert.ok(Math.abs(res.chains[0].points[1].t - 0.4) < 1e-9);
  assert.deepEqual(res.chains[0].srcSegIdx, [0]);
});

test("two footprints on the same segment leave three chains", () => {
  const res = getPolylineOutsidePolygons(line, [
    rect(10, -5, 20, 5),
    rect(70, -5, 80, 5),
  ]);
  assert.deepEqual(res.chains.map(xs), [
    [0, 10],
    [20, 70],
    [80, 100],
  ]);
});

test("a footprint covering an end only shortens the path", () => {
  const res = getPolylineOutsidePolygons(line, [rect(-10, -5, 30, 5)]);
  assert.deepEqual(res.chains.map(xs), [[30, 100]]);
});

test("a hole in the footprint keeps the part of the path inside it", () => {
  const withHole = [...rect(10, -10, 90, 10), ...rect(40, -5, 60, 5)];
  const res = getPolylineOutsidePolygons(line, [withHole]);
  assert.deepEqual(res.chains.map(xs), [
    [0, 10],
    [40, 60],
    [90, 100],
  ]);
});

test("a footprint edge landing on a vertex still cuts there", () => {
  const path = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 50, y: 0 },
    { id: "c", x: 100, y: 0 },
  ];
  const res = getPolylineOutsidePolygons(path, [rect(50, -5, 70, 5)]);
  assert.deepEqual(res.chains.map(xs), [
    [0, 50],
    [70, 100],
  ]);
  assert.equal(res.chains[0].points[1].id, "b");
  assert.deepEqual(res.chains[1].srcSegIdx, [1]);
});

test("a path entirely covered is consumed", () => {
  const res = getPolylineOutsidePolygons(line, [rect(-10, -5, 110, 5)]);
  assert.deepEqual(res, { chains: [], consumed: true });
});

test("a closed path is opened, the chain through its first vertex is one", () => {
  const square = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 100, y: 0 },
    { id: "c", x: 100, y: 100 },
    { id: "d", x: 0, y: 100 },
  ];
  // cuts the bottom edge (c → d) only
  const res = getPolylineOutsidePolygons(square, [rect(40, 90, 60, 110)], {
    closed: true,
  });
  assert.equal(res.chains.length, 1);
  assert.deepEqual(
    res.chains[0].points.map((p) => p.id ?? `${p.x},${p.y}`),
    ["40,100", "d", "a", "b", "c", "60,100"]
  );
  assert.deepEqual(res.chains[0].srcSegIdx, [2, 3, 0, 1, 2]);
});

test("a sliver left between two footprints is dropped", () => {
  const res = getPolylineOutsidePolygons(line, [
    rect(10, -5, 20, 5),
    rect(20.1, -5, 30, 5),
  ]);
  assert.deepEqual(res.chains.map(xs), [
    [0, 10],
    [30, 100],
  ]);
});
