import assert from "node:assert/strict";
import { test } from "node:test";

import getHollowOutPolylineCarve from "./getHollowOutPolylineCarve.js";

const box = (x0, y0, x1, y1) => ({
  points: [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ],
  cuts: [],
});

// "Ligne 3 px": an L drawn on a blank page, covered by a 20 cm band, a
// surface and a rectangle.
const line = {
  id: "line",
  type: "POLYLINE",
  points: [
    { id: "p0", x: 1221.88, y: 1009.879, offsetBottom: 0, offsetTop: 0 },
    { id: "p1", x: 1221.88, y: 1415.763, offsetBottom: 0, offsetTop: 0 },
    { id: "p2", x: 1695.412, y: 1415.763, offsetBottom: 0, offsetTop: 0 },
  ],
};
const band = box(1202.226, 1125.322, 1225.848, 1215.308);
const surface = box(1295.471, 1409.071, 1384.823, 1423.779);
const rectangle = box(1450.001, 1409.9, 1493.365, 1421.799);

const round = (v) => Math.round(v * 1000) / 1000;
const coords = (chain) => chain.points.map((p) => [round(p.x), round(p.y)]);

test("the example line is cut into 4 lines, longest first", () => {
  const carve = getHollowOutPolylineCarve({
    annotation: line,
    footprints: [band, surface, rectangle],
  });
  assert.equal(carve.consumed, false);
  assert.deepEqual(carve.chains.map(coords), [
    // corner piece: under the band → corner → surface
    [
      [1221.88, 1215.308],
      [1221.88, 1415.763],
      [1295.471, 1415.763],
    ],
    // end piece, after the rectangle
    [
      [1493.365, 1415.763],
      [1695.412, 1415.763],
    ],
    // start piece, above the band
    [
      [1221.88, 1009.879],
      [1221.88, 1125.322],
    ],
    // between the surface and the rectangle
    [
      [1384.823, 1415.763],
      [1450.001, 1415.763],
    ],
  ]);
  // original vertices keep their id, cut points are new
  assert.deepEqual(
    carve.chains[0].points.map((p) => p.id),
    [undefined, "p1", undefined]
  );
  assert.equal(carve.pieces.length, 4);
});

test("switching a cutter off keeps the line whole there", () => {
  const carve = getHollowOutPolylineCarve({
    annotation: line,
    footprints: [surface],
  });
  assert.equal(carve.chains.length, 2);
});

test("no footprint on the line → nothing to carve", () => {
  assert.equal(
    getHollowOutPolylineCarve({
      annotation: line,
      footprints: [box(0, 0, 10, 10)],
    }),
    null
  );
});

test("cut points interpolate the heights, chains keep their segment flags", () => {
  const carve = getHollowOutPolylineCarve({
    annotation: {
      type: "STRIP",
      hiddenSegmentsIdx: [1],
      points: [
        { id: "a", x: 0, y: 0, offsetBottom: 0, offsetTop: 0 },
        { id: "b", x: 100, y: 0, offsetBottom: 0, offsetTop: 2 },
        { id: "c", x: 100, y: 100, offsetBottom: 0, offsetTop: 2 },
      ],
    },
    footprints: [box(40, -5, 60, 5)],
  });
  const [long, short] = carve.chains;
  assert.deepEqual(coords(long), [
    [60, 0],
    [100, 0],
    [100, 100],
  ]);
  assert.ok(Math.abs(long.points[0].offsetTop - 1.2) < 1e-9);
  assert.deepEqual(long.segmentFlags, { hiddenSegmentsIdx: [1] });
  assert.ok(Math.abs(short.points[1].offsetTop - 0.8) < 1e-9);
  assert.deepEqual(short.segmentFlags, {});
});

test("a line with an arc is tessellated, then cut", () => {
  const carve = getHollowOutPolylineCarve({
    annotation: {
      type: "POLYLINE",
      points: [
        { id: "a", x: 0, y: 0 },
        { id: "m", x: 50, y: 50, type: "circle" },
        { id: "b", x: 100, y: 0 },
        { id: "c", x: 200, y: 0 },
      ],
    },
    footprints: [box(140, -5, 160, 5)],
  });
  assert.equal(carve.chains.length, 2);
  const withArc = carve.chains.find((chain) => chain.points[0].id === "a");
  assert.ok(withArc.points.length > 4);
  assert.ok(withArc.points.every((p) => p.type !== "circle"));
});
