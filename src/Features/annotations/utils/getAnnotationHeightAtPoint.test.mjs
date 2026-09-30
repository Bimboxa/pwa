import assert from "node:assert/strict";
import { test } from "node:test";

import getAnnotationHeightAtPoint from "./getAnnotationHeightAtPoint.js";

const near = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test("flat polyline: bottom = offsetZ, top = offsetZ + height", () => {
  const r = getAnnotationHeightAtPoint({
    annotation: {
      type: "POLYLINE",
      offsetZ: 1.5,
      height: 2,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    },
    point: { x: 50, y: 10 },
    meterByPx: 0.01,
  });
  near(r.bottom, 1.5);
  near(r.top, 3.5);
});

test("sloped polyline: per-vertex offsets interpolated on the nearest segment", () => {
  const r = getAnnotationHeightAtPoint({
    annotation: {
      type: "POLYLINE",
      offsetZ: 10,
      height: 0,
      points: [
        { x: 0, y: 0, offsetBottom: 0 },
        { x: 100, y: 0, offsetBottom: 1 },
        { x: 100, y: 100, offsetBottom: 3 },
      ],
    },
    point: { x: 25, y: 5 },
    meterByPx: 0.01,
  });
  near(r.bottom, 10.25);
  assert.equal(r.top, null);
});

test("closed line: the closing segment counts", () => {
  const r = getAnnotationHeightAtPoint({
    annotation: {
      type: "POLYLINE",
      closeLine: true,
      offsetZ: 0,
      points: [
        { x: 0, y: 0, offsetBottom: 0 },
        { x: 100, y: 0, offsetBottom: 0 },
        { x: 0, y: 100, offsetBottom: 2 },
      ],
    },
    point: { x: 2, y: 50 },
    meterByPx: 0.01,
  });
  near(r.bottom, 1);
});

test("polygon with a ramp guideLine: top follows the ramp", () => {
  const r = getAnnotationHeightAtPoint({
    annotation: {
      type: "POLYGON",
      offsetZ: 5,
      height: 0,
      points: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 100 },
        { x: 0, y: 100 },
      ],
      guideLines: [
        {
          slopePct: 10,
          points: [
            { x: 0, y: 50 },
            { x: 1000, y: 50 },
          ],
        },
      ],
    },
    point: { x: 500, y: 20 },
    meterByPx: 0.01,
  });
  near(r.bottom, 5);
  near(r.top, 5.5);
});

test("polygon with per-vertex offsetTop: least-squares plane", () => {
  const r = getAnnotationHeightAtPoint({
    annotation: {
      type: "POLYGON",
      offsetZ: 0,
      height: 0.2,
      points: [
        { x: 0, y: 0, offsetTop: 0 },
        { x: 100, y: 0, offsetTop: 1 },
        { x: 100, y: 100, offsetTop: 1 },
        { x: 0, y: 100, offsetTop: 0 },
      ],
    },
    point: { x: 50, y: 50 },
    meterByPx: 0.01,
  });
  near(r.bottom, 0);
  near(r.top, 0.7);
});

test("point-like annotation: offsetZ only", () => {
  const r = getAnnotationHeightAtPoint({
    annotation: { type: "MARKER", offsetZ: 2.25 },
    point: { x: 0, y: 0 },
    meterByPx: 0.01,
  });
  near(r.bottom, 2.25);
  assert.equal(r.top, null);
});
