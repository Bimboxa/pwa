import assert from "node:assert/strict";
import { test } from "node:test";
import getPolygonMainAxisPolyline from "./getPolygonMainAxisPolyline.js";
import { circleFromThreePoints } from "./arcSampling.js";

const near = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

function rotate(points, angleDeg, cx = 0, cy = 0) {
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return points.map((p) => ({
    x: cx + (p.x - cx) * cos - (p.y - cy) * sin,
    y: cy + (p.x - cx) * sin + (p.y - cy) * cos,
  }));
}

test("rectangle: longest median, leftmost end first", () => {
  const rect = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 100 },
    { x: 0, y: 100 },
  ];
  const axis = getPolygonMainAxisPolyline(rect);
  assert.equal(axis.length, 2);
  near(axis[0].x, 0, 1e-6, "start x");
  near(axis[0].y, 50, 1e-6, "start y");
  near(axis[1].x, 400, 1e-6, "end x");
  near(axis[1].y, 50, 1e-6, "end y");
});

test("rotated rectangle: median follows the rotation", () => {
  const rect = rotate(
    [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 100 },
      { x: 0, y: 100 },
    ],
    30,
    200,
    50
  );
  const axis = getPolygonMainAxisPolyline(rect);
  assert.equal(axis.length, 2);
  const expected = rotate(
    [
      { x: 0, y: 50 },
      { x: 400, y: 50 },
    ],
    30,
    200,
    50
  );
  near(axis[0].x, expected[0].x, 1e-6, "start x");
  near(axis[0].y, expected[0].y, 1e-6, "start y");
  near(axis[1].x, expected[1].x, 1e-6, "end x");
  near(axis[1].y, expected[1].y, 1e-6, "end y");
});

// Travel direction of a typed guide line at its start / end (S-C-S aware).
function endTangent(axis, atStart) {
  const pts = atStart ? axis.slice(0, 3) : axis.slice(-3).reverse();
  const p = pts[0];
  if (pts[1]?.type === "circle" && pts[2]) {
    const c = circleFromThreePoints(pts[0], pts[1], pts[2]);
    const rx = p.x - c.center.x;
    const ry = p.y - c.center.y;
    const len = Math.hypot(rx, ry);
    // Orientation is irrelevant for an orthogonality check.
    return { x: -ry / len, y: rx / len };
  }
  const q = pts[1];
  const len = Math.hypot(q.x - p.x, q.y - p.y);
  return { x: (q.x - p.x) / len, y: (q.y - p.y) / len };
}

const orthogonalTo = (t, seg, msg) => {
  const len = Math.hypot(seg.x, seg.y);
  const dot = Math.abs((t.x * seg.x + t.y * seg.y) / len);
  assert.ok(dot <= Math.sin((5 * Math.PI) / 180), `${msg}: |cos| = ${dot}`);
};

test("quarter annulus: one arc between the cap midpoints, orthogonal to the caps", () => {
  // Band between r=100 and r=200, from angle 0 to 90°, centred on (0,0).
  const pts = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI / 2) * (i / n);
    pts.push({ x: 200 * Math.cos(a), y: 200 * Math.sin(a) });
  }
  for (let i = n; i >= 0; i--) {
    const a = (Math.PI / 2) * (i / n);
    pts.push({ x: 100 * Math.cos(a), y: 100 * Math.sin(a) });
  }
  const axis = getPolygonMainAxisPolyline(pts);
  assert.equal(axis.length, 3, "S-C-S arc");
  assert.equal(axis[1].type, "circle");
  near(axis[0].x, 0, 3, "start on the vertical cap midpoint x");
  near(axis[0].y, 150, 3, "start on the vertical cap midpoint y");
  near(axis[2].x, 150, 3, "end on the horizontal cap midpoint x");
  near(axis[2].y, 0, 3, "end on the horizontal cap midpoint y");
  near(
    Math.hypot(axis[1].x, axis[1].y),
    150,
    3,
    "control on the middle radius"
  );
  orthogonalTo(endTangent(axis, true), { x: 0, y: 1 }, "start ⟂ vertical cap");
  orthogonalTo(endTangent(axis, false), { x: 1, y: 0 }, "end ⟂ horizontal cap");
});

test("curved ramp with arcs (real annotation): smooth, from cap middle to cap middle, orthogonal", () => {
  const ramp = [
    { x: 2999.395, y: 4178.599, type: "square" },
    { x: 2999.395, y: 3978.125, type: "square" },
    { x: 3435.185, y: 2841.418, type: "circle" },
    { x: 4682.631, y: 2291.952, type: "square" },
    { x: 4682.631, y: 3375.814, type: "square" },
    { x: 4198.575, y: 3614.698, type: "circle" },
    { x: 4077.732, y: 3981.016, type: "square" },
    { x: 4071.522, y: 4174.191, type: "square" },
  ];
  const axis = getPolygonMainAxisPolyline(ramp);
  assert.ok(axis.length <= 5, `at most a biarc, got ${axis.length} points`);
  assert.ok(
    axis.some((p) => p.type === "circle"),
    "has an arc"
  );
  // Bottom cap (last -> first point) and right cap (4th -> 5th point).
  near(axis[0].x, (4071.522 + 2999.395) / 2, 3, "start x = bottom cap middle");
  near(axis[0].y, (4174.191 + 4178.599) / 2, 3, "start y = bottom cap middle");
  near(axis[axis.length - 1].x, 4682.631, 3, "end x = right cap middle");
  near(
    axis[axis.length - 1].y,
    (2291.952 + 3375.814) / 2,
    3,
    "end y = right cap middle"
  );
  orthogonalTo(
    endTangent(axis, true),
    { x: 4071.522 - 2999.395, y: 4174.191 - 4178.599 },
    "start ⟂ bottom cap"
  );
  orthogonalTo(
    endTangent(axis, false),
    { x: 0, y: 3375.814 - 2291.952 },
    "end ⟂ right cap"
  );
});

test("L shape: path goes through the corner", () => {
  const L = [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 60 },
    { x: 60, y: 60 },
    { x: 60, y: 300 },
    { x: 0, y: 300 },
  ];
  const axis = getPolygonMainAxisPolyline(L);
  assert.equal(
    axis.length,
    3,
    `expected two straight legs, got ${axis.length}`
  );
  assert.ok(
    axis.every((p) => p.type === "square"),
    "no arc on an L"
  );
  const first = axis[0];
  const last = axis[axis.length - 1];
  const nearCorner = axis.some(
    (p) => Math.abs(p.x - 30) < 12 && Math.abs(p.y - 30) < 12
  );
  assert.ok(nearCorner, "passes near the inner corner (30,30)");
  // One end on the left arm (x≈30, y≈300), the other on the top arm.
  const ends = [first, last];
  assert.ok(
    ends.some((p) => Math.abs(p.x - 30) < 12 && p.y > 280),
    "one end at the bottom of the vertical arm"
  );
  assert.ok(
    ends.some((p) => Math.abs(p.y - 30) < 12 && p.x > 280),
    "one end at the right of the horizontal arm"
  );
});

test("degenerate input returns null", () => {
  assert.equal(getPolygonMainAxisPolyline([]), null);
  assert.equal(
    getPolygonMainAxisPolyline([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]),
    null
  );
});
