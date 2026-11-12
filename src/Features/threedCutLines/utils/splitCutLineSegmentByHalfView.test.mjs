import assert from "node:assert/strict";
import { test } from "node:test";

import splitCutLineSegmentByHalfView from "./splitCutLineSegmentByHalfView.js";

// Cylinder of radius 2 about the z axis, z ∈ [0, 3], with its top disc. The
// half y ≥ 0 is displayed; the host carries the hidden half (y ≤ 0).
const R = 2;
const H = 3;
const STEPS = 16;

function buildHiddenHalf() {
  const triangles = [];
  const at = (i) => {
    const phi = Math.PI + (Math.PI * i) / STEPS;
    return { x: R * Math.cos(phi), y: R * Math.sin(phi) };
  };
  for (let i = 0; i < STEPS; i++) {
    const p = at(i);
    const q = at(i + 1);
    // wall
    triangles.push(p.x, p.y, 0, q.x, q.y, 0, q.x, q.y, H);
    triangles.push(p.x, p.y, 0, q.x, q.y, H, p.x, p.y, H);
    // top disc
    triangles.push(0, 0, H, p.x, p.y, H, q.x, q.y, H);
  }
  return triangles;
}

const host = {
  point: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 1, z: 0 },
  triangles: Float64Array.from(buildHiddenHalf()),
  box: { min: { x: -R, y: -R, z: 0 }, max: { x: R, y: 0, z: H } },
};

const pt = (x, y, z) => ({ x, y, z });

test("no half-view host keeps the segment whole", () => {
  assert.deepEqual(splitCutLineSegmentByHalfView(pt(0, 0, 0), pt(1, 0, 0)), [
    { t0: 0, t1: 1, hiddenHalf: false },
  ]);
});

test("a segment on the displayed half stays solid", () => {
  const pieces = splitCutLineSegmentByHalfView(pt(0, R, 0), pt(0, R, H), [
    host,
  ]);
  assert.deepEqual(pieces, [{ t0: 0, t1: 1, hiddenHalf: false }]);
});

test("a segment on the hidden wall is dashed", () => {
  const pieces = splitCutLineSegmentByHalfView(pt(0, -R, 0), pt(0, -R, H), [
    host,
  ]);
  assert.deepEqual(pieces, [{ t0: 0, t1: 1, hiddenHalf: true }]);
});

test("a diameter on the top disc is cut at the boundary plane", () => {
  const pieces = splitCutLineSegmentByHalfView(pt(0, R, H), pt(0, -R / 2, H), [
    host,
  ]);
  assert.equal(pieces.length, 2);
  assert.equal(pieces[0].hiddenHalf, false);
  assert.equal(pieces[1].hiddenHalf, true);
  assert.equal(pieces[0].t0, 0);
  assert.equal(pieces[1].t1, 1);
  assert.ok(Math.abs(pieces[0].t1 - 2 / 3) < 1e-9);
  assert.equal(pieces[1].t0, pieces[0].t1);
});

test("a line on the ground under the hidden half stays solid", () => {
  const pieces = splitCutLineSegmentByHalfView(pt(-1, -1, 0), pt(1, -1, 0), [
    host,
  ]);
  assert.deepEqual(pieces, [{ t0: 0, t1: 1, hiddenHalf: false }]);
});

test("a segment along the boundary seam stays solid", () => {
  const pieces = splitCutLineSegmentByHalfView(pt(R, 0, 0), pt(R, 0, H), [
    host,
  ]);
  assert.deepEqual(pieces, [{ t0: 0, t1: 1, hiddenHalf: false }]);
});

test("a hidden-side segment away from the surface stays solid", () => {
  const pieces = splitCutLineSegmentByHalfView(pt(5, -5, 1), pt(6, -5, 1), [
    host,
  ]);
  assert.deepEqual(pieces, [{ t0: 0, t1: 1, hiddenHalf: false }]);
});
