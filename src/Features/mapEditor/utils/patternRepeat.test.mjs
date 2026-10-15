import assert from "node:assert/strict";
import { test } from "node:test";

import {
  appendToPatternRepeatBuffer,
  getPatternSegmentCount,
  parsePatternRepeatCount,
  repeatDrawingPattern,
  resolvePatternMotif,
} from "./patternRepeat.js";

const xy = (points) => points.map((p) => [p.x, p.y]);

test("buffer: * starts, digits feed the count, others ignored", () => {
  assert.equal(appendToPatternRepeatBuffer("", "3"), "");
  assert.equal(appendToPatternRepeatBuffer("", "*"), "*");
  assert.equal(appendToPatternRepeatBuffer("*", "3"), "*3");
  assert.equal(appendToPatternRepeatBuffer("*3", "."), "*3");
  assert.equal(appendToPatternRepeatBuffer("*3", "*"), "*");
  assert.equal(appendToPatternRepeatBuffer("*99", "1"), "*99");
});

test("count: * alone = 1, *0 = none", () => {
  assert.equal(parsePatternRepeatCount(""), 0);
  assert.equal(parsePatternRepeatCount("*"), 1);
  assert.equal(parsePatternRepeatCount("*3"), 3);
  assert.equal(parsePatternRepeatCount("*0"), 0);
  assert.equal(parsePatternRepeatCount("3"), 0);
});

test("stairs: riser + tread repeated 3 times", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 2, y: 1 },
  ];
  const repeated = repeatDrawingPattern(points, 3);
  assert.deepEqual(xy(repeated), [
    [2, 2],
    [4, 2],
    [4, 3],
    [6, 3],
    [6, 4],
    [8, 4],
  ]);
  assert.equal(repeated.at(-1).patternAnchor, true);
  assert.equal(repeated.at(-1).motifLength, 2);
  assert.equal(
    repeated.slice(0, -1).some((p) => p.patternAnchor),
    false
  );
});

test("nothing drawn since the last repetition: the same pattern again", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 2, y: 1 },
  ];
  const once = [...points, ...repeatDrawingPattern(points, 1)];
  assert.deepEqual(xy(repeatDrawingPattern(once, 1)), [
    [4, 3],
    [6, 3],
  ]);
});

test("drawn after a repetition: only the new segments repeat", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 2, y: 1 },
  ];
  const withLanding = [
    ...points,
    ...repeatDrawingPattern(points, 1),
    { x: 7, y: 2 },
  ];
  assert.equal(getPatternSegmentCount(withLanding), 1);
  assert.deepEqual(xy(repeatDrawingPattern(withLanding, 2)), [
    [10, 2],
    [13, 2],
  ]);
});

test("closed pattern / single point: nothing repeats", () => {
  const closed = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 0 },
  ];
  assert.equal(resolvePatternMotif(closed), null);
  assert.deepEqual(repeatDrawingPattern(closed, 3), []);
  assert.deepEqual(repeatDrawingPattern([{ x: 0, y: 0 }], 3), []);
  assert.equal(getPatternSegmentCount([]), 0);
});

test("3D vertices: z is translated too", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0.17 },
    { x: 0.28, y: 0, z: 0.17 },
  ];
  const repeated = repeatDrawingPattern(points, 1);
  assert.equal(repeated.length, 2);
  assert.ok(Math.abs(repeated[0].z - 0.34) < 1e-9);
  assert.ok(Math.abs(repeated[1].x - 0.56) < 1e-9);
});

test("snap links are dropped, the point type is kept", () => {
  const points = [
    { x: 0, y: 0, type: "square", existingPointId: "p0" },
    {
      x: 1,
      y: 0,
      type: "circle",
      snapSegment: { annotationId: "a" },
      meshKey: "m",
      nodeId: "n",
      faceNormal: { x: 0, y: 0, z: 1 },
      baseMapId: "b",
    },
  ];
  const [copy] = repeatDrawingPattern(points, 1);
  assert.equal(copy.type, "circle");
  assert.equal(copy.baseMapId, "b");
  for (const key of [
    "existingPointId",
    "snapSegment",
    "meshKey",
    "nodeId",
    "faceNormal",
  ]) {
    assert.equal(copy[key], undefined);
  }
});
