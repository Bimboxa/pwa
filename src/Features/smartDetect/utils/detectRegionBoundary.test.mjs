import assert from "node:assert/strict";
import { test } from "node:test";

import detectRegionBoundary from "./detectRegionBoundary.js";

const WIDTH = 600;
const HEIGHT = 500;
const CENTER = { x: 620, y: 520 };
const RADIUS = 480;

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

// White page with a speckled grey disc (point-cloud scan look): inside the
// disc, each pixel is inked with probability `density`.
function speckledDisc({ density = 0.6, inside = true } = {}) {
  const random = createRandom(42);
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(255);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const inDisc =
        Math.hypot(x + 0.5 - CENTER.x, y + 0.5 - CENTER.y) <= RADIUS;
      if (inDisc !== inside || random() > density) continue;
      const grey = 60 + Math.floor(random() * 80);
      const i = (y * WIDTH + x) * 4;
      data[i] = grey;
      data[i + 1] = grey;
      data[i + 2] = grey;
    }
  }
  return { width: WIDTH, height: HEIGHT, data };
}

const REGION = [
  { x: 60, y: 420 },
  { x: 150, y: 120 },
  { x: 420, y: 40 },
  { x: 520, y: 200 },
  { x: 300, y: 300 },
  { x: 220, y: 460 },
];

test("follows the edge of a speckled disc", () => {
  const result = detectRegionBoundary({
    imageData: speckledDisc(),
    regionPoints: REGION,
  });
  assert.ok(result.points, `no boundary: ${result.reason}`);
  assert.equal(result.closed, false);
  assert.ok(result.points.length > 50);

  let maxDeviation = 0;
  for (const p of result.points) {
    const deviation = Math.abs(
      Math.hypot(p.x - CENTER.x, p.y - CENTER.y) - RADIUS
    );
    if (deviation > maxDeviation) maxDeviation = deviation;
  }
  assert.ok(maxDeviation < 3, `max deviation ${maxDeviation.toFixed(2)} px`);

  // the chain crosses the whole region
  const first = result.points[0];
  const last = result.points[result.points.length - 1];
  assert.ok(Math.hypot(last.x - first.x, last.y - first.y) > 250);
});

test("same edge on a downsampled analysis grid", () => {
  const result = detectRegionBoundary({
    imageData: speckledDisc(),
    regionPoints: REGION,
    maxAnalysisSize: 160,
  });
  assert.ok(result.points, `no boundary: ${result.reason}`);
  assert.equal(result.cellSize, 3);
  for (const p of result.points) {
    const deviation = Math.abs(
      Math.hypot(p.x - CENTER.x, p.y - CENTER.y) - RADIUS
    );
    assert.ok(deviation < 5, `deviation ${deviation.toFixed(2)} px`);
  }
});

test("no boundary in a blank or a uniformly inked region", () => {
  const imageData = speckledDisc();
  const blank = detectRegionBoundary({
    imageData,
    regionPoints: [
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 90, y: 90 },
      { x: 10, y: 90 },
    ],
  });
  assert.equal(blank.points, null);
  assert.equal(blank.reason, "NO_BOUNDARY");

  const inked = detectRegionBoundary({
    imageData,
    regionPoints: [
      { x: 400, y: 300 },
      { x: 580, y: 300 },
      { x: 580, y: 480 },
      { x: 400, y: 480 },
    ],
  });
  assert.equal(inked.points, null);
  assert.equal(inked.reason, "NO_BOUNDARY");
});

test("rejects a degenerate region", () => {
  const result = detectRegionBoundary({
    imageData: speckledDisc(),
    regionPoints: [
      { x: 10, y: 10 },
      { x: 90, y: 10 },
    ],
  });
  assert.equal(result.reason, "INVALID_REGION");
});
