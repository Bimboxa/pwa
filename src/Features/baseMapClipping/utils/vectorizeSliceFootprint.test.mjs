import assert from "node:assert/strict";
import test from "node:test";

import vectorizeSliceFootprint from "./vectorizeSliceFootprint.js";

// deterministic pseudo random generator (mulberry32)
function createRandom(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ribbon of points along the segment a→b: `density` points per metre,
// uniform lateral noise of ± `noise`, skipping the abscissas of `gaps`
// ([from, to] in metres along the segment).
function ribbon(
  out,
  random,
  a,
  b,
  { density = 2000, noise = 0.003, gaps = [] }
) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / length,
    uy = (b[1] - a[1]) / length;
  const n = Math.round(length * density);
  for (let i = 0; i < n; i++) {
    const s = random() * length;
    if (gaps.some(([from, to]) => s >= from && s <= to)) continue;
    const d = (random() * 2 - 1) * noise;
    out.push(a[0] + ux * s - uy * d, a[1] + uy * s + ux * d);
  }
}

function distanceToSegment(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

// smallest distance from p to the vertices of the polylines
function distanceToVertices(polylines, p) {
  let best = Infinity;
  polylines.forEach(({ points }) =>
    points.forEach((q) => {
      best = Math.min(best, Math.hypot(q.x - p[0], q.y - p[1]));
    })
  );
  return best;
}

test("noisy L-shaped wall: one polyline, corner and ends within 1 cm", () => {
  const random = createRandom(1);
  const points = [];
  ribbon(points, random, [1, 1], [4, 1], {});
  ribbon(points, random, [4, 1], [4, 3], {});
  const { polylines } = vectorizeSliceFootprint({
    points: new Float32Array(points),
  });
  assert.equal(polylines.length, 1);
  const [polyline] = polylines;
  assert.equal(polyline.closed, false);
  assert.equal(polyline.points.length, 3);
  assert.ok(distanceToVertices(polylines, [4, 1]) < 0.01);
  assert.ok(distanceToVertices(polylines, [1, 1]) < 0.01);
  assert.ok(distanceToVertices(polylines, [4, 3]) < 0.01);
  assert.ok(Math.abs(polyline.length - 5) < 0.03);
  assert.ok(polyline.score > 0.8);
});

test("slanted line: sub-cell accuracy, no axis snapping", () => {
  const random = createRandom(2);
  const points = [];
  // 17° line
  const a = [0.5, 0.5],
    b = [0.5 + 3 * Math.cos(0.3), 0.5 + 3 * Math.sin(0.3)];
  ribbon(points, random, a, b, {});
  const { polylines } = vectorizeSliceFootprint({
    points: new Float32Array(points),
  });
  assert.equal(polylines.length, 1);
  const [first, last] = [
    polylines[0].points[0],
    polylines[0].points[polylines[0].points.length - 1],
  ];
  const angle = Math.atan2(last.y - first.y, last.x - first.x);
  const folded =
    Math.abs(angle) > Math.PI / 2 ? angle - Math.sign(angle) * Math.PI : angle;
  assert.ok(Math.abs(folded - 0.3) < 0.003);
  // every vertex within 3 mm of the true line (cell = 1 cm)
  polylines[0].points.forEach((p) =>
    assert.ok(
      distanceToSegment(p, { x: a[0], y: a[1] }, { x: b[0], y: b[1] }) < 0.003
    )
  );
});

test("ribbon with sampling gaps: a single stroke", () => {
  const random = createRandom(3);
  const points = [];
  ribbon(points, random, [0, 2], [3, 2], {
    gaps: [
      [0.8, 0.83],
      [1.9, 1.935],
    ],
  });
  const { polylines } = vectorizeSliceFootprint({
    points: new Float32Array(points),
  });
  assert.equal(polylines.length, 1);
  assert.ok(Math.abs(polylines[0].length - 3) < 0.03);
});

test("scattered noise: no stroke", () => {
  const random = createRandom(4);
  const points = [];
  for (let i = 0; i < 400; i++) points.push(random() * 5, random() * 5);
  const { polylines } = vectorizeSliceFootprint({
    points: new Float32Array(points),
  });
  assert.equal(polylines.length, 0);
});

test("wall + scattered noise: the wall only", () => {
  const random = createRandom(5);
  const points = [];
  ribbon(points, random, [1, 2.5], [4, 2.5], {});
  for (let i = 0; i < 300; i++) points.push(random() * 5, random() * 5);
  const { polylines } = vectorizeSliceFootprint({
    points: new Float32Array(points),
  });
  assert.equal(polylines.length, 1);
  assert.ok(Math.abs(polylines[0].length - 3) < 0.05);
});

test("circle: one closed loop on the circle", () => {
  const random = createRandom(6);
  const points = [];
  const radius = 2;
  for (let i = 0; i < 25000; i++) {
    const angle = random() * 2 * Math.PI;
    const r = radius + (random() * 2 - 1) * 0.003;
    points.push(5 + r * Math.cos(angle), 5 + r * Math.sin(angle));
  }
  const { polylines } = vectorizeSliceFootprint({
    points: new Float32Array(points),
  });
  assert.equal(polylines.length, 1);
  const [loop] = polylines;
  assert.equal(loop.closed, true);
  assert.ok(loop.points.length >= 8);
  loop.points.forEach((p) => {
    const r = Math.hypot(p.x - 5, p.y - 5);
    assert.ok(Math.abs(r - radius) < 0.03);
  });
  assert.ok(Math.abs(loop.length - 2 * Math.PI * radius) < 0.15);
});

test("two faces of a wall, 20 cm apart: two distinct strokes", () => {
  const random = createRandom(7);
  const points = [];
  ribbon(points, random, [1, 1], [4, 1], {});
  ribbon(points, random, [1, 1.2], [4, 1.2], {});
  const { polylines } = vectorizeSliceFootprint({
    points: new Float32Array(points),
  });
  assert.equal(polylines.length, 2);
  const ys = polylines.map((p) => p.points[0].y).sort();
  assert.ok(Math.abs(ys[0] - 1) < 0.005);
  assert.ok(Math.abs(ys[1] - 1.2) < 0.005);
});

test("T junction: three strokes sharing one joint", () => {
  const random = createRandom(8);
  const points = [];
  ribbon(points, random, [1, 1], [5, 1], {});
  ribbon(points, random, [3, 1], [3, 3], {});
  const { polylines } = vectorizeSliceFootprint({
    points: new Float32Array(points),
  });
  assert.equal(polylines.length, 3);
  const joints = polylines.flatMap((p) =>
    p.points.filter((q) => q.joint !== undefined)
  );
  assert.equal(joints.length, 3);
  joints.forEach((q) => {
    assert.equal(q.joint, joints[0].joint);
    assert.ok(Math.hypot(q.x - 3, q.y - 1) < 0.015);
  });
});

test("empty or tiny input: nothing", () => {
  assert.equal(
    vectorizeSliceFootprint({ points: new Float32Array(0) }).polylines.length,
    0
  );
  assert.equal(vectorizeSliceFootprint({ points: [1, 1] }).polylines.length, 0);
});
