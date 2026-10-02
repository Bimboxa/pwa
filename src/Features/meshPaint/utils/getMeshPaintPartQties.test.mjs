import assert from "node:assert/strict";
import { test } from "node:test";

import getMeshPaintPartQties from "./getMeshPaintPartQties.js";

// Non-square image: 1000 × 600 px at 1 cm / px → 10 m × 6 m. A frame bug
// (normalized x / y scaled by the same size) shows up as a wrong area.
const metrics = { imageWidth: 1000, imageHeight: 600, meterByPx: 0.01 };

// base-map-local meters → stored point [nx, ny, z]
const P = (x, y, z = 0) => [
  (x / metrics.meterByPx + metrics.imageWidth / 2) / metrics.imageWidth,
  (-y / metrics.meterByPx + metrics.imageHeight / 2) / metrics.imageHeight,
  z,
];

const near = (actual, expected, tol = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `expected ${expected}, got ${actual}`
  );

const rect = (x0, y0, x1, y1, z = 0) => [
  P(x0, y0, z),
  P(x1, y0, z),
  P(x1, y1, z),
  P(x0, y1, z),
];

test("horizontal FACE spanning x and y on a non-square image", () => {
  const qties = getMeshPaintPartQties(
    {
      partType: "FACE",
      geometry: {
        polygons: [{ contour: rect(-1, -1.5, 1, 1.5, 3), holes: [] }],
        normal: [0, 0, 1],
      },
    },
    metrics
  );
  assert.equal(qties.enabled, true);
  near(qties.surface, 6);
  assert.equal(qties.length, 0);
});

test("FACE with holes: area minus holes whatever the hole winding", () => {
  const contour = rect(0, 0, 2, 3, 1);
  const holeCcw = rect(0.5, 0.5, 1.5, 1.5, 1); // same winding as the contour
  const holeCw = [...rect(0.5, 2, 1.5, 2.5, 1)].reverse();
  const qties = getMeshPaintPartQties(
    {
      partType: "FACE",
      geometry: {
        polygons: [{ contour, holes: [holeCcw, holeCw] }],
        normal: [0, 0, 1],
      },
    },
    metrics
  );
  near(qties.surface, 6 - 1 - 0.5);
});

test("vertical FACE (1 × 2.5 m wall side) with a hole, two polygons", () => {
  const wall = (y) => [P(0, y, 0), P(1, y, 0), P(1, y, 2.5), P(0, y, 2.5)];
  const hole = [P(0.2, 1, 0.5), P(0.4, 1, 0.5), P(0.4, 1, 1), P(0.2, 1, 1)];
  const qties = getMeshPaintPartQties(
    {
      partType: "FACE",
      geometry: {
        polygons: [
          { contour: wall(1), holes: [hole] },
          // second island of the same face (cut by an opening), same plane
          {
            contour: [P(2, 1, 0), P(3, 1, 0), P(3, 1, 1), P(2, 1, 1)],
            holes: [],
          },
        ],
        normal: [0, -1, 0],
      },
    },
    metrics
  );
  near(qties.surface, 2.5 - 0.1 + 1);
});

test("EDGE: 3-4-5 length, z included", () => {
  const flat = getMeshPaintPartQties(
    { partType: "EDGE", geometry: { points: [P(1, 1, 0), P(4, 5, 0)] } },
    metrics
  );
  near(flat.length, 5);
  assert.equal(flat.surface, 0);

  const inSpace = getMeshPaintPartQties(
    { partType: "EDGE", geometry: { points: [P(0, 0, 0), P(0, 3, 4)] } },
    metrics
  );
  near(inSpace.length, 5);
});

test("no metrics or malformed geometry → disabled", () => {
  const face = {
    partType: "FACE",
    geometry: { polygons: [{ contour: rect(0, 0, 1, 1) }], normal: [0, 0, 1] },
  };
  assert.equal(getMeshPaintPartQties(face, null).enabled, false);
  assert.equal(
    getMeshPaintPartQties(
      { partType: "FACE", geometry: { polygons: [], normal: [0, 0, 1] } },
      metrics
    ).enabled,
    false
  );
  assert.equal(
    getMeshPaintPartQties(
      { partType: "EDGE", geometry: { points: [P(0, 0)] } },
      metrics
    ).enabled,
    false
  );
  assert.equal(getMeshPaintPartQties(null, metrics).enabled, false);
});
