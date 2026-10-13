import assert from "node:assert/strict";
import { test } from "node:test";

import computeLayoutLineBars, {
  getLayoutLineRingsPx,
} from "./computeLayoutLineBars.js";

// 100 px = 1 m
const meterByPx = 0.01;

const near = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b}`);

const rect = (x0, y0, x1, y1) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

const RECT = rect(0, 0, 400, 200);
const HOLE = rect(150, 75, 250, 125);

test("rectangle + centered hole, horizontal line, SPACING 50 cm CENTER", () => {
  const res = computeLayoutLineBars({
    linePoints: [
      { x: 0, y: 100 },
      { x: 400, y: 100 },
    ],
    outerRing: RECT,
    cutRings: [HOLE],
    meterByPx,
    densityMode: "SPACING",
    densityValue: 50,
    layoutAlign: "CENTER",
  });
  near(res.spacingPx, 50);
  assert.equal(res.barCount, 9); // floor(400/50) + 1
  let expectedTotal = 0;
  for (const bar of res.bars) {
    // Bars lying exactly on a hole edge (x = 150 / 250) are deducted too —
    // same boundary rule as the outer contour (chord kept on the boundary).
    const inHole = bar.point.x >= 150 && bar.point.x <= 250;
    if (inHole) {
      assert.equal(bar.pieces.length, 2);
      near(bar.lengthM, 1.5);
    } else {
      assert.equal(bar.pieces.length, 1);
      near(bar.lengthM, 2);
    }
    // bars are vertical (orthogonal to the horizontal line)
    near(Math.abs(bar.dir.x), 0);
    near(Math.abs(bar.dir.y), 1);
    expectedTotal += bar.lengthM;
  }
  near(res.totalLengthM, expectedTotal);
  near(res.totalLengthM, 9 * 2 - 3 * 0.5); // x ∈ {150, 200, 250} cross the hole
});

test("L-shape: the bar stops at the first contact, no re-entry piece", () => {
  // L: 400 wide bottom arm (y 100..200) + left arm (x 0..100, y 0..100)
  const L = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 400, y: 100 },
    { x: 400, y: 200 },
    { x: 0, y: 200 },
  ];
  // Vertical line inside the left arm at x = 50; bars are horizontal.
  const res = computeLayoutLineBars({
    linePoints: [
      { x: 50, y: 10 },
      { x: 50, y: 190 },
    ],
    outerRing: L,
    cutRings: [],
    meterByPx,
    densityMode: "SPACING",
    densityValue: 60,
    layoutAlign: "LEFT",
  });
  assert.ok(res.barCount >= 2);
  for (const bar of res.bars) {
    assert.equal(bar.pieces.length, 1);
    if (bar.point.y < 100)
      near(bar.lengthM, 1); // upper arm: 100 px
    else near(bar.lengthM, 4); // bottom arm: 400 px
  }
});

test("ticks outside the outer ring produce no bar, ticks in a hole still do", () => {
  const res = computeLayoutLineBars({
    linePoints: [
      { x: -200, y: 100 },
      { x: 200, y: 100 },
    ],
    outerRing: RECT,
    cutRings: [HOLE],
    meterByPx,
    densityMode: "SPACING",
    densityValue: 50,
    layoutAlign: "LEFT",
  });
  // ticks at x = -200, -150, ..., 200 → 9 offsets, only x ∈ [0, 200] → 5 bars
  assert.equal(res.barCount, 5);
  const inHole = res.bars.find((b) => Math.abs(b.point.x - 200) < 1e-6);
  assert.ok(inHole);
  assert.equal(inHole.pieces.length, 2);
  near(inHole.lengthM, 1.5);
  const onEdge = res.bars.find((b) => Math.abs(b.point.x) < 1e-6);
  assert.ok(onEdge, "tick on the contour edge keeps a bar");
  near(onEdge.lengthM, 2);
});

test("PER_METER 4 → 25 cm spacing", () => {
  const res = computeLayoutLineBars({
    linePoints: [
      { x: 10, y: 50 },
      { x: 110, y: 50 },
    ],
    outerRing: RECT,
    cutRings: [],
    meterByPx,
    densityMode: "PER_METER",
    densityValue: 4,
    layoutAlign: "LEFT",
  });
  near(res.spacingPx, 25);
  assert.equal(res.barCount, 5);
});

test("LEFT / RIGHT alignment on a non-multiple length", () => {
  const line = [
    { x: 20, y: 100 },
    { x: 150, y: 100 },
  ]; // 130 px, spacing 50 → 3 bars
  const right = computeLayoutLineBars({
    linePoints: line,
    outerRing: RECT,
    cutRings: [],
    meterByPx,
    densityMode: "SPACING",
    densityValue: 50,
    layoutAlign: "RIGHT",
  });
  assert.equal(right.barCount, 3);
  near(right.bars[right.bars.length - 1].t, 130);
  const left = computeLayoutLineBars({
    linePoints: line,
    outerRing: RECT,
    cutRings: [],
    meterByPx,
    densityMode: "SPACING",
    densityValue: 50,
    layoutAlign: "LEFT",
  });
  near(left.bars[0].t, 0);
});

test("bar collinear with a contour edge spans the whole edge", () => {
  const res = computeLayoutLineBars({
    linePoints: [
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ],
    outerRing: RECT,
    cutRings: [],
    meterByPx,
    densityMode: "SPACING",
    densityValue: 100,
    layoutAlign: "LEFT",
  });
  const first = res.bars.find((b) => Math.abs(b.t) < 1e-6);
  assert.ok(first);
  near(first.lengthM, 2);
});

test("polyline with a right-angle corner: per-segment normals, no NaN", () => {
  const res = computeLayoutLineBars({
    linePoints: [
      { x: 50, y: 50 },
      { x: 250, y: 50 },
      { x: 250, y: 150 },
    ],
    outerRing: RECT,
    cutRings: [],
    meterByPx,
    densityMode: "SPACING",
    densityValue: 100,
    layoutAlign: "LEFT",
  });
  // length 300 → ticks at 0, 100, 200, 300
  assert.equal(res.barCount, 4);
  for (const bar of res.bars) {
    assert.ok(Number.isFinite(bar.lengthM));
    assert.ok(
      bar.pieces.every((p) => Number.isFinite(p.a.x) && Number.isFinite(p.b.y))
    );
  }
  const onCorner = res.bars.find((b) => Math.abs(b.t - 200) < 1e-6);
  // incoming (horizontal) segment → vertical bar
  near(Math.abs(onCorner.dir.y), 1);
  const after = res.bars.find((b) => Math.abs(b.t - 300) < 1e-6);
  near(Math.abs(after.dir.x), 1);
});

test("getLayoutLineRingsPx + empty results never throw", () => {
  const rings = getLayoutLineRingsPx({
    points: RECT,
    cuts: [{ points: HOLE }, { points: [] }],
  });
  assert.equal(rings.outerRing.length, 4);
  assert.equal(rings.cutRings.length, 1);
  const empty = computeLayoutLineBars({
    linePoints: [{ x: 0, y: 0 }],
    outerRing: RECT,
    meterByPx,
    densityMode: "SPACING",
    densityValue: 10,
  });
  assert.equal(empty.barCount, 0);
  const noScale = computeLayoutLineBars({
    linePoints: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    outerRing: RECT,
    meterByPx: null,
    densityMode: "SPACING",
    densityValue: 10,
  });
  assert.equal(noScale.barCount, 0);
  assert.equal(noScale.lengthPx, 10);
});

test("coverWholeSurface extends the distribution beyond both ends", () => {
  // Short line in the middle of the rectangle: without cover → 3 bars,
  // with cover → bars every 50 px over the whole 400 px width (x = 0..400).
  const line = [
    { x: 150, y: 100 },
    { x: 250, y: 100 },
  ];
  const common = {
    outerRing: RECT,
    cutRings: [HOLE],
    meterByPx,
    densityMode: "SPACING",
    densityValue: 50,
    layoutAlign: "LEFT",
  };
  const noCover = computeLayoutLineBars({ linePoints: line, ...common });
  assert.equal(noCover.barCount, 3);
  assert.equal(noCover.extensions.length, 0);

  const cover = computeLayoutLineBars({
    linePoints: line,
    ...common,
    coverWholeSurface: true,
  });
  assert.equal(cover.barCount, 9);
  assert.equal(cover.extensions.length, 2);
  // sorted by t, extended flags on both sides, indexes sequential
  const ts = cover.bars.map((b) => b.t);
  assert.deepEqual(ts, [-150, -100, -50, 0, 50, 100, 150, 200, 250]);
  assert.deepEqual(
    cover.bars.map((b) => b.extended),
    [true, true, true, false, false, false, true, true, true]
  );
  assert.deepEqual(
    cover.bars.map((b) => b.index),
    [0, 1, 2, 3, 4, 5, 6, 7, 8]
  );
  near(cover.totalLengthM, 9 * 2 - 3 * 0.5);
  // extension strokes start on the line ends
  near(cover.extensions[0].a.x, 150);
  near(cover.extensions[1].a.x, 250);
});
