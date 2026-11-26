import assert from "node:assert/strict";
import { test } from "node:test";

import vectorizeHighlightStroke from "./vectorizeHighlightStroke.js";

const WIDTH = 700;
const HEIGHT = 500;
const RADIUS = 24;

// Deterministic pseudo-random generator (mulberry32).
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

function blankPage() {
  return {
    width: WIDTH,
    height: HEIGHT,
    data: new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(255),
  };
}

// 2 x 2 dark dot (point-cloud scan look).
function drawDot(image, x, y) {
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const px = Math.round(x) + dx;
      const py = Math.round(y) + dy;
      if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) continue;
      const i = (py * WIDTH + px) * 4;
      image.data[i] = 40;
      image.data[i + 1] = 40;
      image.data[i + 2] = 40;
    }
  }
}

// Sparse dots along a → b: one every `step` px, `noise` px of lateral jitter.
function scatterLine(image, a, b, { step = 9, noise = 1.5, random }) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  for (let s = 0; s <= length; s += step) {
    const jitter = (random() * 2 - 1) * noise;
    drawDot(image, a.x + ux * s - uy * jitter, a.y + uy * s + ux * jitter);
  }
}

function distanceToLine(p, a, b) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return (
    Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / length
  );
}

// Hand-drawn stroke: samples every 6 px along the polyline, 5 px of wobble.
function wobblyStroke(vertices, random) {
  const stroke = [];
  for (let i = 0; i + 1 < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    for (let s = 0; s < length; s += 6) {
      stroke.push({
        x: a.x + ((b.x - a.x) * s) / length + (random() * 2 - 1) * 5,
        y: a.y + ((b.y - a.y) * s) / length + (random() * 2 - 1) * 5,
      });
    }
  }
  stroke.push(vertices[vertices.length - 1]);
  return stroke;
}

test("fits a single segment through sparse oblique dots", () => {
  const random = createRandom(7);
  const image = blankPage();
  const a = { x: 100, y: 400 };
  const b = { x: 600, y: 150 };
  scatterLine(image, a, b, { random });
  const result = vectorizeHighlightStroke({
    imageData: image,
    strokePoints: wobblyStroke([a, b], random),
    radius: RADIUS,
  });
  assert.ok(result.points, `no line: ${result.reason}`);
  assert.equal(result.points.length, 2);
  for (const p of result.points) assert.ok(distanceToLine(p, a, b) < 2);
  assert.ok(Math.hypot(result.points[0].x - a.x, result.points[0].y - a.y) < 6);
  assert.ok(Math.hypot(result.points[1].x - b.x, result.points[1].y - b.y) < 6);
});

test("stops on the dots when the stroke overshoots them", () => {
  const random = createRandom(11);
  const image = blankPage();
  const a = { x: 250, y: 250 };
  const b = { x: 450, y: 230 };
  scatterLine(image, a, b, { random });
  const result = vectorizeHighlightStroke({
    imageData: image,
    strokePoints: wobblyStroke(
      [
        { x: 100, y: 265 },
        { x: 620, y: 213 },
      ],
      random
    ),
    radius: RADIUS,
  });
  assert.ok(result.points, `no line: ${result.reason}`);
  assert.equal(result.points.length, 2);
  assert.ok(Math.hypot(result.points[0].x - a.x, result.points[0].y - a.y) < 6);
  assert.ok(Math.hypot(result.points[1].x - b.x, result.points[1].y - b.y) < 6);
});

test("finds the bend of an elbow", () => {
  const random = createRandom(3);
  const image = blankPage();
  const a = { x: 80, y: 420 };
  const corner = { x: 420, y: 300 };
  const c = { x: 470, y: 60 };
  scatterLine(image, a, corner, { random });
  scatterLine(image, corner, c, { random });
  const result = vectorizeHighlightStroke({
    imageData: image,
    strokePoints: wobblyStroke([a, corner, c], random),
    radius: RADIUS,
  });
  assert.ok(result.points, `no line: ${result.reason}`);
  assert.equal(result.points.length, 3);
  const bend = result.points[1];
  assert.ok(Math.hypot(bend.x - corner.x, bend.y - corner.y) < 6);
});

test("ignores stray dots under the stroke", () => {
  const random = createRandom(5);
  const image = blankPage();
  const a = { x: 100, y: 250 };
  const b = { x: 600, y: 250 };
  scatterLine(image, a, b, { random, noise: 1 });
  for (let x = 150; x < 600; x += 90) drawDot(image, x, 250 + 16);
  const result = vectorizeHighlightStroke({
    imageData: image,
    strokePoints: wobblyStroke([a, b], random),
    radius: RADIUS,
  });
  assert.ok(result.points, `no line: ${result.reason}`);
  assert.equal(result.points.length, 2);
  for (const p of result.points) assert.ok(distanceToLine(p, a, b) < 2);
});

test("works on a large stroke analysed on a coarser grid", () => {
  const random = createRandom(9);
  const image = blankPage();
  const a = { x: 60, y: 440 };
  const b = { x: 640, y: 60 };
  scatterLine(image, a, b, { random, step: 3 });
  const result = vectorizeHighlightStroke({
    imageData: image,
    strokePoints: [a, b],
    radius: RADIUS,
    maxAnalysisSize: 200,
  });
  assert.ok(result.points, `no line: ${result.reason}`);
  assert.equal(result.cellSize, 4);
  for (const p of result.points) assert.ok(distanceToLine(p, a, b) < 5);
});

test("reports a blank area and a click", () => {
  const image = blankPage();
  assert.equal(
    vectorizeHighlightStroke({
      imageData: image,
      strokePoints: [
        { x: 100, y: 100 },
        { x: 400, y: 120 },
      ],
      radius: RADIUS,
    }).reason,
    "NO_INK"
  );
  assert.equal(
    vectorizeHighlightStroke({
      imageData: image,
      strokePoints: [
        { x: 100, y: 100 },
        { x: 101, y: 100 },
      ],
      radius: RADIUS,
    }).reason,
    "INVALID_STROKE"
  );
});

test('"LINE" fits one segment through an elbow-free noisy run', () => {
  const random = createRandom(13);
  const image = blankPage();
  const a = { x: 300, y: 40 };
  const b = { x: 310, y: 460 };
  scatterLine(image, a, b, { random, noise: 4 });
  const result = vectorizeHighlightStroke({
    imageData: image,
    strokePoints: wobblyStroke([a, b], random),
    radius: RADIUS,
    shape: "LINE",
  });
  assert.ok(result.points, `no line: ${result.reason}`);
  assert.equal(result.points.length, 2);
  for (const p of result.points) assert.ok(distanceToLine(p, a, b) < 2.5);
});

test('"RIGHT_ANGLE" squares an elbow in the frame of the dots', () => {
  const random = createRandom(17);
  const image = blankPage();
  // frame rotated by ~10°, elbow drawn at 86° instead of 90°
  const a = { x: 100, y: 380 };
  const corner = { x: 440, y: 320 };
  const c = { x: 405, y: 80 };
  scatterLine(image, a, corner, { random });
  scatterLine(image, corner, c, { random });
  const result = vectorizeHighlightStroke({
    imageData: image,
    strokePoints: wobblyStroke([a, corner, c], random),
    radius: RADIUS,
    shape: "RIGHT_ANGLE",
  });
  assert.ok(result.points, `no line: ${result.reason}`);
  assert.equal(result.points.length, 3);
  const [p0, p1, p2] = result.points;
  const dot = (p0.x - p1.x) * (p2.x - p1.x) + (p0.y - p1.y) * (p2.y - p1.y);
  const cosine =
    dot /
    (Math.hypot(p0.x - p1.x, p0.y - p1.y) *
      Math.hypot(p2.x - p1.x, p2.y - p1.y));
  assert.ok(Math.abs(cosine) < 1e-6);
  assert.ok(Math.hypot(p1.x - corner.x, p1.y - corner.y) < 12);
});

test('"ARC" fits one arc, its middle point typed "circle"', () => {
  const random = createRandom(19);
  const image = blankPage();
  const centre = { x: 350, y: 420 };
  const arcRadius = 300;
  const stroke = [];
  for (let deg = 200; deg <= 320; deg += 0.8) {
    const angle = (deg * Math.PI) / 180;
    const jitter = (random() * 2 - 1) * 1.5;
    drawDot(
      image,
      centre.x + (arcRadius + jitter) * Math.cos(angle),
      centre.y + (arcRadius + jitter) * Math.sin(angle)
    );
    stroke.push({
      x: centre.x + (arcRadius + (random() * 2 - 1) * 5) * Math.cos(angle),
      y: centre.y + (arcRadius + (random() * 2 - 1) * 5) * Math.sin(angle),
    });
  }
  const result = vectorizeHighlightStroke({
    imageData: image,
    strokePoints: stroke,
    radius: RADIUS,
    shape: "ARC",
  });
  assert.ok(result.points, `no arc: ${result.reason}`);
  assert.equal(result.points.length, 3);
  assert.deepEqual(
    result.points.map((p) => p.type),
    [undefined, "circle", undefined]
  );
  for (const p of result.points) {
    const deviation = Math.hypot(p.x - centre.x, p.y - centre.y) - arcRadius;
    assert.ok(Math.abs(deviation) < 3, `off the circle by ${deviation}`);
  }
  // ends on the first / last dots (200° and 320°)
  const end = (deg) => ({
    x: centre.x + arcRadius * Math.cos((deg * Math.PI) / 180),
    y: centre.y + arcRadius * Math.sin((deg * Math.PI) / 180),
  });
  assert.ok(
    Math.hypot(
      result.points[0].x - end(200).x,
      result.points[0].y - end(200).y
    ) < 8
  );
  assert.ok(
    Math.hypot(
      result.points[2].x - end(320).x,
      result.points[2].y - end(320).y
    ) < 8
  );
});

test('"ARC" falls back to a segment on aligned dots', () => {
  const random = createRandom(23);
  const image = blankPage();
  const a = { x: 100, y: 250 };
  const b = { x: 600, y: 250 };
  scatterLine(image, a, b, { random, noise: 0 });
  const result = vectorizeHighlightStroke({
    imageData: image,
    strokePoints: [a, b],
    radius: RADIUS,
    shape: "ARC",
  });
  assert.ok(result.points, `no line: ${result.reason}`);
  assert.equal(result.points.length, 2);
});

test("chains several strokes, the jump between them highlights nothing", () => {
  const random = createRandom(29);
  const image = blankPage();
  const a = { x: 80, y: 250 };
  const b = { x: 620, y: 250 };
  scatterLine(image, a, b, { random, noise: 1 });
  // junk between the two strokes, off the line but within a stroke width
  for (let x = 300; x <= 400; x += 4) drawDot(image, x, 250 - 14);
  const result = vectorizeHighlightStroke({
    imageData: image,
    strokes: [
      { points: wobblyStroke([a, { x: 280, y: 250 }], random), radius: RADIUS },
      { points: wobblyStroke([{ x: 420, y: 250 }, b], random), radius: 12 },
    ],
  });
  assert.ok(result.points, `no line: ${result.reason}`);
  assert.equal(result.points.length, 2);
  for (const p of result.points) assert.ok(distanceToLine(p, a, b) < 2);
  assert.ok(Math.hypot(result.points[0].x - a.x, result.points[0].y - a.y) < 6);
  assert.ok(Math.hypot(result.points[1].x - b.x, result.points[1].y - b.y) < 6);
});
