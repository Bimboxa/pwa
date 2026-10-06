import assert from "node:assert/strict";
import { test } from "node:test";

import buildWallBandAnnotationFields from "./buildWallBandAnnotationFields.js";

const METRICS = { imageWidth: 1000, imageHeight: 500 };

test("flat floor: offsetZ = floor, height = top − floor, normalized points", () => {
  const fields = buildWallBandAnnotationFields(
    {
      sloped: false,
      baseZ: 0.1,
      topZ: 2.6,
      closeLine: false,
      points: [
        { x: 0, y: 100, bottomZ: 0.1, topZ: 2.6 },
        { x: 400, y: 100, bottomZ: 0.1, topZ: 2.6 },
      ],
    },
    METRICS
  );
  assert.deepEqual(fields, {
    points: [
      { x: 0, y: 0.2, offsetBottom: 0, offsetTop: 0 },
      { x: 0.4, y: 0.2, offsetBottom: 0, offsetTop: 0 },
    ],
    offsetZ: 0.1,
    height: 2.5,
    closeLine: false,
  });
});

test("sloped floor: height 0, absolute per-vertex offsets from baseZ", () => {
  const fields = buildWallBandAnnotationFields(
    {
      sloped: true,
      baseZ: 1,
      topZ: 3,
      closeLine: true,
      points: [
        { x: 0, y: 100, bottomZ: 1, topZ: 3 },
        { x: 400, y: 100, bottomZ: 1.5, topZ: 3 },
      ],
    },
    METRICS
  );
  assert.equal(fields.offsetZ, 1);
  assert.equal(fields.height, 0);
  assert.equal(fields.closeLine, true);
  assert.deepEqual(
    fields.points.map((p) => [p.offsetBottom, p.offsetTop]),
    [
      [0, 2],
      [0.5, 2],
    ]
  );
});

test("degenerate runs give null", () => {
  assert.equal(buildWallBandAnnotationFields(null, METRICS), null);
  assert.equal(
    buildWallBandAnnotationFields(
      {
        sloped: false,
        topZ: 1,
        points: [
          { x: 0, y: 0, bottomZ: 1 },
          { x: 1, y: 0, bottomZ: 1 },
        ],
      },
      METRICS
    ),
    null
  );
});
