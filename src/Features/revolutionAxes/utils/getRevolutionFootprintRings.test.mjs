import assert from "node:assert/strict";
import { test } from "node:test";

import getRevolutionFootprintRings, {
  getRevolutionRadiusIntervals,
  SEGMENTS_PER_TURN,
} from "./getRevolutionFootprintRings.js";

// Arc base map: 0.01 m/px, lathe axis at x = 100. Plan: 0.02 m/px, centre
// (500, 400).
const AXIS_PTS = [
  { x: 100, y: 300 },
  { x: 100, y: 200 },
];
const M_ARC = 0.01;
const M_PLAN = 0.02;
const axis = { point: { x: 500, y: 400 } };

const profile = (xs, extra = {}) => ({
  type: "POLYLINE",
  shape3D: { key: "REVOLUTION", axisAnnotationId: "axis" },
  revolutionAxisPoints: AXIS_PTS,
  points: xs.map((x, i) => ({ x, y: 300 - i * 50 })),
  ...extra,
});

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const radiusPx = (p) => Math.hypot(p.x - axis.point.x, p.y - axis.point.y);
const maxR = (ring) => Math.max(...ring.map(radiusPx));
const minR = (ring) => Math.min(...ring.map(radiusPx));

test("open shell: annulus between the min and max radius", () => {
  // radii 2 m, 3 m, 2.5 m
  const arc = profile([300, 400, 350]);
  assert.deepEqual(getRevolutionRadiusIntervals(arc, M_ARC), [[2, 3]]);
  const fp = getRevolutionFootprintRings({
    arc,
    axis,
    arcMeterByPx: M_ARC,
    planMeterByPx: M_PLAN,
  });
  assert.equal(fp.isLine, false);
  assert.equal(fp.closed, true);
  assert.equal(fp.rings.length, 2);
  assert.equal(fp.rings[0].length, SEGMENTS_PER_TURN);
  assert.ok(near(maxR(fp.rings[0]), 3 / M_PLAN));
  assert.ok(near(minR(fp.rings[1]), 2 / M_PLAN));
});

test("solid open profile: disc closed toward the axis", () => {
  const arc = profile([300, 400, 350], {
    shape3D: { key: "REVOLUTION", axisAnnotationId: "axis", solid: true },
    hiddenSegmentsIdx: [0],
  });
  assert.deepEqual(getRevolutionRadiusIntervals(arc, M_ARC), [[0, 3]]);
  const fp = getRevolutionFootprintRings({
    arc,
    axis,
    arcMeterByPx: M_ARC,
    planMeterByPx: M_PLAN,
  });
  assert.equal(fp.rings.length, 1);
});

test("solid closed profile: torus → annulus", () => {
  const arc = {
    ...profile([300, 400, 400, 300]),
    shape3D: { key: "REVOLUTION", axisAnnotationId: "axis", solid: true },
  };
  arc.points[3] = { ...arc.points[0] };
  assert.deepEqual(getRevolutionRadiusIntervals(arc, M_ARC), [[2, 3]]);
});

test("hidden segment splits the profile into two annuli", () => {
  // run 1: radii 2 → 2.2 ; hidden ; run 2: radii 4 → 4.5
  const arc = profile([300, 320, 500, 550], { hiddenSegmentsIdx: [1] });
  assert.deepEqual(getRevolutionRadiusIntervals(arc, M_ARC), [
    [2, 2.2],
    [4, 4.5],
  ]);
  const fp = getRevolutionFootprintRings({
    arc,
    axis,
    arcMeterByPx: M_ARC,
    planMeterByPx: M_PLAN,
  });
  assert.equal(fp.rings.length, 4);
});

test("overlapping runs are merged", () => {
  const arc = profile([300, 400, 350, 450], { hiddenSegmentsIdx: [1] });
  assert.deepEqual(getRevolutionRadiusIntervals(arc, M_ARC), [[2, 3.5]]);
});

test("a segment crossing the axis brings rMin to 0", () => {
  // x = 50 is on the other side of the axis (x = 100)
  const arc = profile([300, 50]);
  assert.deepEqual(getRevolutionRadiusIntervals(arc, M_ARC), [[0, 2]]);
});

test("POINT: a circle line", () => {
  const arc = {
    type: "POINT",
    shape3D: { key: "REVOLUTION", axisAnnotationId: "axis" },
    revolutionAxisPoints: AXIS_PTS,
    point: { x: 250, y: 300 },
  };
  const fp = getRevolutionFootprintRings({
    arc,
    axis,
    arcMeterByPx: M_ARC,
    planMeterByPx: M_PLAN,
  });
  assert.equal(fp.isLine, true);
  assert.equal(fp.closed, true);
  assert.equal(fp.rings.length, 1);
  assert.ok(near(maxR(fp.rings[0]), 1.5 / M_PLAN));
});

test("partial revolution: annular sector, CCW from start to end, y up", () => {
  const partialAxis = {
    ...axis,
    partialRevolution: true,
    revolutionAngleStartDeg: 0,
    revolutionAngleEndDeg: 90,
  };
  const arc = profile([300, 400]);
  const fp = getRevolutionFootprintRings({
    arc,
    axis: partialAxis,
    arcMeterByPx: M_ARC,
    planMeterByPx: M_PLAN,
  });
  assert.equal(fp.rings.length, 1);
  const ring = fp.rings[0];
  // 19 outer points (quarter of 72 = 18 segments) + 19 inner points
  assert.equal(ring.length, 38);
  // first point: +X at the outer radius; the quarter ends at −Y on screen
  assert.ok(near(ring[0].x, axis.point.x + 3 / M_PLAN));
  assert.ok(near(ring[0].y, axis.point.y));
  assert.ok(near(ring[18].x, axis.point.x));
  assert.ok(near(ring[18].y, axis.point.y - 3 / M_PLAN));
  // inner arc walks back to the start angle
  assert.ok(near(ring[37].x, axis.point.x + 2 / M_PLAN));
  assert.ok(near(ring[37].y, axis.point.y));
});

test("partial revolution through the centre: pie slice", () => {
  const partialAxis = {
    ...axis,
    partialRevolution: true,
    revolutionAngleStartDeg: 0,
    revolutionAngleEndDeg: 180,
  };
  const arc = profile([300, 50]);
  const fp = getRevolutionFootprintRings({
    arc,
    axis: partialAxis,
    arcMeterByPx: M_ARC,
    planMeterByPx: M_PLAN,
  });
  const ring = fp.rings[0];
  const last = ring[ring.length - 1];
  assert.deepEqual(last, { x: axis.point.x, y: axis.point.y });
});

test("partial revolution POINT: open arc", () => {
  const partialAxis = {
    ...axis,
    partialRevolution: true,
    revolutionAngleStartDeg: 10,
    revolutionAngleEndDeg: 100,
  };
  const arc = {
    type: "POINT",
    shape3D: { key: "REVOLUTION", axisAnnotationId: "axis" },
    revolutionAxisPoints: AXIS_PTS,
    point: { x: 250, y: 300 },
  };
  const fp = getRevolutionFootprintRings({
    arc,
    axis: partialAxis,
    arcMeterByPx: M_ARC,
    planMeterByPx: M_PLAN,
  });
  assert.equal(fp.closed, false);
});

test("nothing to draw without a resolved axis or scale", () => {
  const arc = profile([300, 400]);
  assert.equal(
    getRevolutionFootprintRings({
      arc: { ...arc, revolutionAxisPoints: undefined },
      axis,
      arcMeterByPx: M_ARC,
      planMeterByPx: M_PLAN,
    }),
    null
  );
  assert.equal(
    getRevolutionFootprintRings({
      arc,
      axis,
      arcMeterByPx: M_ARC,
      planMeterByPx: 0,
    }),
    null
  );
});
