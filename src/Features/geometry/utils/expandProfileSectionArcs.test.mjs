import assert from "node:assert/strict";
import { test } from "node:test";

import expandProfileSectionArcs from "./expandProfileSectionArcs.js";

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} ~ ${expected}`);

// Profile applied from an "arc de cercle" drawing: collinear plan chain on
// the guide normal, folded on the base point (middle vertex, h = 0), both
// ends at the same plan position. Units: meters.
const folded = [
  { x: 10, y: 20.2, height: 2.0, type: "square" },
  { x: 10, y: 18.2, height: 0, type: "circle" },
  { x: 10, y: 20.2, height: -2.0, type: "square" },
];

test("straight-only profiles pass through untouched", () => {
  const out = expandProfileSectionArcs([
    { x: 0, y: 0, height: 1 },
    { x: 1, y: 0, height: 0 },
  ]);
  assert.deepEqual(out, [
    { x: 0, y: 0, height: 1 },
    { x: 1, y: 0, height: 0 },
  ]);
});

test("folded S-C-S profile samples a true arc in (s, h) space", () => {
  const out = expandProfileSectionArcs(folded);
  // 2 half-arcs × 12 samples + the first vertex
  assert.equal(out.length, 25);
  // endpoints preserved
  near(out[0].x, 10);
  near(out[0].y, 20.2);
  near(out[0].height, 2);
  near(out[24].x, 10);
  near(out[24].y, 20.2);
  near(out[24].height, -2);
  // plan chain stays collinear on the axis (x constant)
  for (const p of out) near(p.x, 10);
  // every sample lies on the circle through the three section points
  // (s, h) = (0, 2), (2, 0), (0, -2) → center (0, 0), r = 2
  for (const p of out) {
    const s = 20.2 - p.y; // signed abscissa along the axis (first → middle)
    near(Math.hypot(s, p.height), 2, 1e-6);
  }
  // the arc really bulges: a sample sits near s = 2 at mid height ~ 0
  const mid = out[12];
  near(20.2 - mid.y, 2);
  near(mid.height, 0);
  // the quarter sample is NOT on the chord (V shape would give s = 1 at h = 1)
  const q = out[6];
  assert.ok(20.2 - q.y > 1.3, `bulge ${20.2 - q.y}`);
});

test("perpendicular component of an off-axis control point is carried", () => {
  // control point 0.5 left of the axis, ends on it
  const out = expandProfileSectionArcs([
    { x: 0, y: 0, height: 0 },
    { x: 1, y: 0.5, height: 1, type: "circle" },
    { x: 2, y: 0, height: 0 },
  ]);
  const mid = out[12];
  near(mid.x, 1);
  near(mid.y, 0.5);
  near(mid.height, 1);
  near(out[6].y, 0.25);
});
