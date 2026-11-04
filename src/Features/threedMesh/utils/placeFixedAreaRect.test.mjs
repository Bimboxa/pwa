import assert from "node:assert/strict";
import { test } from "node:test";

import placeFixedAreaRect from "./placeFixedAreaRect.js";
import {
  intersection,
  multiPolygonArea,
  rectMultiPolygon,
} from "./polygonBoolean2d.js";
import { chordThroughPoint } from "./polygonChord2d.js";

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );

// MultiPolygon of one polygon from open [x, y] rings.
const polygon = (...rings) => [rings.map((ring) => [...ring, ring[0]])];
const box = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
const nearRect = (rect, [xMin, yMin, xMax, yMax], eps = 1e-6) => {
  near(rect.xMin, xMin, eps);
  near(rect.yMin, yMin, eps);
  near(rect.xMax, xMax, eps);
  near(rect.yMax, yMax, eps);
};
// The rectangle lies inside the host.
const assertInside = (rect, host) =>
  near(
    multiPolygonArea(intersection(rectMultiPolygon(rect), host)),
    (rect.xMax - rect.xMin) * (rect.yMax - rect.yMin),
    1e-7
  );

test("chordThroughPoint: runs of a polygon with a hole", () => {
  const loops = [
    box(0, 0, 10, 4).map(([x, y]) => ({ x, y })),
    box(4, 1, 6, 3).map(([x, y]) => ({ x, y })),
  ];
  assert.deepEqual(chordThroughPoint(loops, { x: 2, y: 2 }, "H"), {
    lo: 0,
    hi: 4,
  });
  assert.deepEqual(chordThroughPoint(loops, { x: 8, y: 2 }, "H"), {
    lo: 6,
    hi: 10,
  });
  assert.deepEqual(chordThroughPoint(loops, { x: 2, y: 2 }, "V"), {
    lo: 0,
    hi: 4,
  });
  assert.equal(chordThroughPoint(loops, { x: 5, y: 2 }, "H"), null);
  assert.equal(chordThroughPoint(loops, { x: 12, y: 2 }, "H"), null);
});

test("a square leans on the corner nearest to the cursor", () => {
  const border = polygon(box(0, 0, 4, 3));
  const low = placeFixedAreaRect({
    border,
    cursor2d: { x: 0.3, y: 0.2 },
    targetArea: 1,
  });
  assert.equal(low.fits, true);
  nearRect(low.rect, [0, 0, 1, 1]);
  near(low.area, 1);

  const high = placeFixedAreaRect({
    border,
    cursor2d: { x: 3.8, y: 2.9 },
    targetArea: 1,
  });
  nearRect(high.rect, [3, 2, 4, 3]);
});

test("a cell too low turns the square into a band, too small fills it", () => {
  const border = polygon(box(0, 0, 4, 3));
  const band = placeFixedAreaRect({
    border,
    cursor2d: { x: 0.3, y: 0.2 },
    targetArea: 10,
  });
  assert.equal(band.fits, true);
  nearRect(band.rect, [0, 0, 10 / 3, 3]);
  near(band.area, 10);

  const tooBig = placeFixedAreaRect({
    border,
    cursor2d: { x: 0.3, y: 0.2 },
    targetArea: 20,
  });
  assert.equal(tooBig.fits, false);
  nearRect(tooBig.rect, [0, 0, 4, 3]);
  near(tooBig.area, 12);
});

test("an existing maille in a corner is a border", () => {
  // 10 × 10 slab minus the [0, 2]² corner.
  const border = polygon([
    [2, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 2],
    [2, 2],
  ]);
  const right = placeFixedAreaRect({
    border,
    cursor2d: { x: 3, y: 1 },
    targetArea: 4,
  });
  nearRect(right.rect, [2, 0, 4, 2]);
  const above = placeFixedAreaRect({
    border,
    cursor2d: { x: 1, y: 3 },
    targetArea: 4,
  });
  nearRect(above.rect, [0, 2, 2, 4]);
});

test("the chord box is shrunk out of a notch", () => {
  // 10 × 10 minus the top-right [6, 10]² corner, cursor in the middle.
  const border = polygon([
    [0, 0],
    [10, 0],
    [10, 6],
    [6, 6],
    [6, 10],
    [0, 10],
  ]);
  const placed = placeFixedAreaRect({
    border,
    cursor2d: { x: 5, y: 5 },
    targetArea: 1,
  });
  const { cell } = placed;
  near((cell.xMax - cell.xMin) * (cell.yMax - cell.yMin), 60);
  assertInside(cell, border);
  assert.ok(cell.xMin <= 5 && cell.xMax >= 5);
  assert.ok(cell.yMin <= 5 && cell.yMax >= 5);
  assertInside(placed.rect, border);
});

test("a maille in the middle of the face shrinks the cell", () => {
  const border = polygon(box(0, 0, 10, 10), box(6, 6, 8, 8));
  const placed = placeFixedAreaRect({
    border,
    cursor2d: { x: 5, y: 5 },
    targetArea: 100,
  });
  assert.equal(placed.fits, false);
  assertInside(placed.cell, border);
  near(placed.area, 60);
});

test("a slanted edge keeps the largest box under it", () => {
  const border = polygon([
    [0, 0],
    [4, 0],
    [0, 3],
  ]);
  const placed = placeFixedAreaRect({
    border,
    cursor2d: { x: 1, y: 1 },
    targetArea: 100,
  });
  nearRect(placed.cell, [0, 0, 2, 1.5]);
  assertInside(placed.cell, border);
});

test("openings are spanned and the target is the net area", () => {
  // 10 × 3 wall with a 1 × 1 window at [2, 3] × [1, 2].
  const border = polygon(box(0, 0, 10, 3));
  const openings = polygon(box(2, 1, 3, 2));
  const square = placeFixedAreaRect({
    border,
    openings,
    cursor2d: { x: 0.3, y: 0.2 },
    targetArea: 6,
  });
  // s² − (s − 2) = 6
  const s = (1 + Math.sqrt(17)) / 2;
  assert.equal(square.fits, true);
  nearRect(square.rect, [0, 0, s, s], 1e-6);
  near(square.area, 6, 1e-6);
  near(square.grossArea, s * s, 1e-6);

  // Band over the whole height: 3 w − 1 = 14.
  const band = placeFixedAreaRect({
    border,
    openings,
    cursor2d: { x: 0.3, y: 0.2 },
    targetArea: 14,
  });
  nearRect(band.rect, [0, 0, 5, 3], 1e-6);
  near(band.area, 14, 1e-6);

  // Whole wall: 29 m² net.
  const tooBig = placeFixedAreaRect({
    border,
    openings,
    cursor2d: { x: 0.3, y: 0.2 },
    targetArea: 40,
  });
  assert.equal(tooBig.fits, false);
  near(tooBig.area, 29, 1e-6);

  assert.equal(
    placeFixedAreaRect({
      border,
      openings,
      cursor2d: { x: 2.5, y: 1.5 },
      targetArea: 6,
    }),
    null
  );
});

test("a free edge snaps on a vertex, the area stays exact", () => {
  const border = polygon([
    [0, 0],
    [4, 0],
    [4, 3],
    [1.02, 3],
    [0, 3],
  ]);
  const placed = placeFixedAreaRect({
    border,
    cursor2d: { x: 0.3, y: 0.2 },
    targetArea: 1,
    snapToleranceM: 0.05,
  });
  assert.equal(placed.snapped, true);
  near(placed.width, 1.02, 1e-9);
  near(placed.height, 1 / 1.02, 1e-9);
  near(placed.area, 1, 1e-9);
});

test("no host under the cursor", () => {
  assert.equal(
    placeFixedAreaRect({
      border: polygon(box(0, 0, 4, 3)),
      cursor2d: { x: 5, y: 1 },
      targetArea: 1,
    }),
    null
  );
});
