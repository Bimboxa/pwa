import assert from "node:assert/strict";
import { test } from "node:test";

import clipRegionByCutLines from "./clipRegionByCutLines.js";
import { foldedStrip } from "./cutLineFixtures.mjs";

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );

const v = (x, y, z) => ({ x, y, z });

// Vertical line through the middle of quad `i` of the strip (on its plane).
const midLine = (strip, i) => {
  const a = strip.corners[i];
  const b = strip.corners[i + 1];
  const m = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  return [v(m.x, -0.5, m.z), v(m.x, 1.5, m.z)];
};

// Point on quad `i` of the strip at fraction `f` of its width, height y.
const pointOn = (strip, i, f, y = 0.5) => {
  const a = strip.corners[i];
  const b = strip.corners[i + 1];
  return v(a.x + f * (b.x - a.x), y, a.z + f * (b.z - a.z));
};

test("a line across the middle quad splits a 3-quad strip in two groups", () => {
  const strip = foldedStrip({ count: 3, foldDeg: 10 });
  const result = clipRegionByCutLines({
    positions: strip.positions,
    tris: strip.tris,
    cutLines: [midLine(strip, 1)],
  });
  assert.ok(result);
  assert.equal(result.facets.length, 3);
  assert.equal(result.pieces.length, 4);
  assert.equal(result.groups.length, 2);
  for (const group of result.groups) {
    assert.equal(group.cut, true);
    assert.equal(group.pieceIndices.length, 2);
    near(group.area, 1.5);
  }
  near(
    result.pieces.reduce((sum, p) => sum + p.area, 0),
    3
  );

  const left = result.locate(0, pointOn(strip, 0, 0.5));
  const leftHalf = result.locate(2, pointOn(strip, 1, 0.25));
  const rightHalf = result.locate(3, pointOn(strip, 1, 0.75));
  const right = result.locate(5, pointOn(strip, 2, 0.5));
  assert.ok(left && leftHalf && rightHalf && right);
  assert.equal(left.groupIndex, leftHalf.groupIndex);
  assert.equal(right.groupIndex, rightHalf.groupIndex);
  assert.notEqual(left.groupIndex, right.groupIndex);
  assert.notEqual(leftHalf.pieceIndex, rightHalf.pieceIndex);
  // The whole left quad is one uncut piece.
  assert.equal(result.pieces[left.pieceIndex].cut, false);
  near(result.pieces[left.pieceIndex].area, 1);
  assert.equal(result.locate(99, pointOn(strip, 0, 0.5)), null);
});

test("without any line the strip is one uncut group", () => {
  const strip = foldedStrip({ count: 3, foldDeg: 10 });
  const result = clipRegionByCutLines({
    positions: strip.positions,
    tris: strip.tris,
    cutLines: [],
  });
  assert.ok(result);
  assert.equal(result.pieces.length, 3);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].cut, false);
  near(result.groups[0].area, 3);
});

test("a line drawn along a crease separates the two sides", () => {
  const strip = foldedStrip({ count: 3, foldDeg: 10 });
  const seam = strip.corners[1];
  const result = clipRegionByCutLines({
    positions: strip.positions,
    tris: strip.tris,
    cutLines: [[v(seam.x, -0.5, seam.z), v(seam.x, 1.5, seam.z)]],
  });
  assert.ok(result);
  assert.equal(result.groups.length, 2);
  const areas = result.groups.map((g) => g.area).sort((a, b) => a - b);
  near(areas[0], 1);
  near(areas[1], 2);
  for (const group of result.groups) assert.equal(group.cut, true);
});

test("a planar region behaves like clipFaceByCutLines", () => {
  const strip = foldedStrip({ count: 2, foldDeg: 0 });
  const result = clipRegionByCutLines({
    positions: strip.positions,
    tris: strip.tris,
    cutLines: [midLine(strip, 0)],
  });
  assert.ok(result);
  // One facet (both quads coplanar), cut in two.
  assert.equal(result.facets.length, 1);
  assert.equal(result.pieces.length, 2);
  assert.equal(result.groups.length, 2);
  const areas = result.groups.map((g) => g.area).sort((a, b) => a - b);
  near(areas[0], 0.5);
  near(areas[1], 1.5);
});
