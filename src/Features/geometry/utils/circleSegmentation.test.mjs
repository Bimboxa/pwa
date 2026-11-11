import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { adaptiveArcSamples } from "./arcSampling.js";
import {
  applyCircleSegmentation,
  getArcSegmentsPerCircle,
  getRevolutionSegmentsPerCircle,
  normalizeCircleSegmentation,
  scaleArcSamples,
} from "./circleSegmentation.js";

afterEach(() => applyCircleSegmentation(null));

test("defaults: 24 chords per arc circle, 64 per revolution", () => {
  assert.equal(getArcSegmentsPerCircle(), 24);
  assert.equal(getRevolutionSegmentsPerCircle(), 64);
  // A 4-point circle: four quarter-turn half-arcs of 6 samples = 24 chords.
  assert.equal(adaptiveArcSamples(Math.PI / 2), 6);
  // Per-half-arc cap of the default segmentation.
  assert.equal(adaptiveArcSamples(Math.PI * 2), 12);
  assert.equal(scaleArcSamples(6), 6);
});

test("a custom arc count drives the adaptive and the scaled samples", () => {
  applyCircleSegmentation({ arc: 48, revolution: 32 });
  assert.equal(adaptiveArcSamples(Math.PI / 2), 12);
  assert.equal(adaptiveArcSamples(Math.PI * 2), 24);
  assert.equal(scaleArcSamples(6), 12);
  assert.equal(getRevolutionSegmentsPerCircle(), 32);
  applyCircleSegmentation({ arc: 8 });
  assert.equal(adaptiveArcSamples(Math.PI / 2), 2);
  assert.equal(scaleArcSamples(6), 2);
});

test("normalize: integers within bounds, defaults for invalid values", () => {
  assert.deepEqual(normalizeCircleSegmentation(null), {
    arc: 24,
    revolution: 64,
  });
  assert.deepEqual(normalizeCircleSegmentation({ arc: 2, revolution: 9999 }), {
    arc: 8,
    revolution: 256,
  });
  assert.deepEqual(
    normalizeCircleSegmentation({ arc: "36.4", revolution: "abc" }),
    { arc: 36, revolution: 64 }
  );
});
