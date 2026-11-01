import { test } from "node:test";
import assert from "node:assert/strict";

import worldToBaseMapNormalized from "../../baseMaps/js/worldToBaseMapNormalized.js";

import getAnnotationRingsWorld from "./getAnnotationRingsWorld.js";

// « Page blanche 1 » of the user's report: an A4 landscape page at 1/100.
const baseMap = {
  id: "lMUW60BbIYZ_IsTI1sFlS",
  orientation: "HORIZONTAL",
  angleDeg: 0,
  position: { x: 0, y: 0, z: 0 },
  image: { imageSize: { width: 2480, height: 1754 } },
  meterByPx: 0.008466666666666666,
};

const ref = (id, x, y, offsetBottom = 0, offsetTop = 0) => ({
  id,
  type: "square",
  x,
  y,
  offsetBottom,
  offsetTop,
});

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test("a closed 3D polyline (risers) gives one ring of world vertices", () => {
  // Rectangle wall 3.2 m high: two posts, each visited at z 0 and z 3.2.
  const annotation = {
    type: "POLYLINE",
    closeLine: true,
    offsetZ: 0,
    baseMapId: baseMap.id,
    points: [
      ref("A", 1101.811, 1212.285, 0),
      ref("A", 1101.811, 1212.285, 3.2),
      ref("B", 895.441, 1212.285, 3.2),
      ref("B", 895.441, 1212.285, 0),
    ],
  };
  const rings = getAnnotationRingsWorld(annotation, baseMap);
  assert.equal(rings.length, 1);
  assert.equal(rings[0].isHole, false);
  const ring = rings[0].ring;
  assert.equal(ring.length, 4);
  // HORIZONTAL base map: the plan normal is world +Y.
  assert.deepEqual(
    ring.map((v) => Math.round(v.y * 1000) / 1000 + 0),
    [0, 3.2, 3.2, 0]
  );
  for (const v of ring) assert.equal(v.baseMapId, baseMap.id);
  // Round trip through the commit projection: plan position and offset back.
  const back = ring.map((v) => worldToBaseMapNormalized(v, baseMap));
  assert.ok(near(back[0].x, 1101.811 / 2480));
  assert.ok(near(back[0].y, 1212.285 / 1754));
  assert.ok(near(back[1].offset, 3.2));
  assert.ok(near(back[2].x, 895.441 / 2480));
});

test("a stepped profile keeps its six corners in order", () => {
  const annotation = {
    type: "POLYLINE",
    closeLine: true,
    offsetZ: 0,
    points: [
      ref("P1", 1237.622, 1233.184, 0),
      ref("P1", 1237.622, 1233.184, 0.861),
      ref("P2", 1310.83, 1233.184, 0.861),
      ref("P2", 1310.83, 1233.184, 1.26),
      ref("P3", 1425.436, 1233.184, 1.26),
      ref("P3", 1425.436, 1233.184, 0),
    ],
  };
  const [{ ring }] = getAnnotationRingsWorld(annotation, baseMap);
  assert.deepEqual(
    ring.map((v) => Math.round(v.y * 1000) / 1000 + 0),
    [0, 0.861, 0.861, 1.26, 1.26, 0]
  );
});

test("the closing duplicate of a closed ring is merged, a riser back is not", () => {
  const closedBack = {
    type: "POLYLINE",
    closeLine: true,
    points: [
      ref("A", 0, 0),
      ref("B", 100, 0),
      ref("C", 100, 100),
      ref("A", 0, 0),
    ],
  };
  assert.equal(getAnnotationRingsWorld(closedBack, baseMap)[0].ring.length, 3);
  const riserBack = {
    type: "POLYLINE",
    closeLine: true,
    points: [ref("A", 0, 0, 0), ref("B", 100, 0, 0), ref("A", 0, 0, 2)],
  };
  assert.equal(getAnnotationRingsWorld(riserBack, baseMap)[0].ring.length, 3);
});

test("a flat polygon reads its top altitude and its cuts as holes", () => {
  const annotation = {
    type: "POLYGON",
    offsetZ: 1.5,
    height: 0,
    points: [
      ref("A", 0, 0, 0, 0),
      ref("B", 1000, 0, 0.5, 0),
      ref("C", 1000, 1000, 0, 0.25),
      ref("D", 0, 1000),
    ],
    cuts: [
      {
        id: "cut",
        points: [ref("H1", 200, 200), ref("H2", 400, 200), ref("H3", 400, 400)],
      },
      { id: "degenerate", points: [ref("X", 0, 0), ref("Y", 1, 1)] },
    ],
  };
  const rings = getAnnotationRingsWorld(annotation, baseMap);
  assert.equal(rings.length, 2);
  assert.deepEqual(
    rings[0].ring.map((v) => Math.round(v.y * 1000) / 1000 + 0),
    [1.5, 2, 1.75, 1.5]
  );
  assert.equal(rings[1].isHole, true);
  assert.equal(rings[1].ring.length, 3);
  assert.ok(rings[1].ring.every((v) => near(v.y, 1.5)));
});

test("sliding refs are dropped and arc points baked", () => {
  const annotation = {
    type: "POLYLINE",
    closeLine: false,
    points: [
      ref("A", 0, 0),
      { ...ref("S", 50, 0), isSliding: true },
      { ...ref("C", 100, 50), type: "circle" },
      ref("B", 200, 0),
    ],
  };
  const [{ ring }] = getAnnotationRingsWorld(annotation, baseMap);
  // Anchors kept, the arc sampled between them: more than the 3 inputs.
  assert.ok(ring.length > 3);
  assert.ok(ring.every((v) => v.type === undefined));
});
