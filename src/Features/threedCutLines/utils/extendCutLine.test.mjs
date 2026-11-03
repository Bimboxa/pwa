import assert from "node:assert/strict";
import { test } from "node:test";

import extendCutLine, {
  computeNewellPlane,
  describeCutLineEnd,
} from "./extendCutLine.js";
import {
  P,
  near,
  nearPoint,
  nearPoints,
  slab,
  wall,
} from "./cutLineFixtures.mjs";

const UP = { normal: P(0, 0, 1) };
const FRONT = { normal: P(0, -1, 0) };
const SCENE = [...slab(), ...wall()];

test("(a) slab + wall: both ends extended, the trace climbs over the wall and stops at the free edges", () => {
  const drawn = [P(2, 1, 0), P(2, 3, 0)];
  const r = extendCutLine({
    drawn,
    startFace: UP,
    endFace: UP,
    triangles: SCENE,
  });
  nearPoints(r.points, [
    P(2, 0, 0),
    P(2, 1, 0),
    P(2, 3, 0),
    P(2, 5, 0),
    P(2, 5, 3),
    P(2, 5.2, 3),
    P(2, 5.2, 0),
    P(2, 10, 0),
  ]);
  assert.equal(r.derivedStart, 1);
  assert.equal(r.derivedEnd, 5);
  // The drawn points are returned as given (same objects).
  assert.equal(r.points[1], drawn[0]);
  assert.equal(r.points[2], drawn[1]);
});

test("(b) slab alone: stops at both free edges", () => {
  const r = extendCutLine({
    drawn: [P(2, 1, 0), P(2, 3, 0)],
    startFace: UP,
    endFace: UP,
    triangles: slab(),
  });
  nearPoints(r.points, [P(2, 0, 0), P(2, 1, 0), P(2, 3, 0), P(2, 10, 0)]);
  assert.equal(r.derivedStart, 1);
  assert.equal(r.derivedEnd, 1);
});

test("(c) closed box, trace on top: one loop around the box, no infinite loop", () => {
  const drawn = [P(2, 5.05, 3), P(2, 5.1, 3)];
  const r = extendCutLine({
    drawn,
    startFace: UP,
    endFace: UP,
    triangles: wall(),
  });
  assert.ok(r.points.length <= 64 + 64 + 2);
  // Both ends share the x = 2 plane: the start extension goes round and
  // stops when it reaches the end node; the end extension then has nowhere
  // unvisited to go.
  nearPoints(r.points, [
    P(2, 5.2, 3),
    P(2, 5.2, 0),
    P(2, 5, 0),
    P(2, 5, 3),
    P(2, 5.05, 3),
    P(2, 5.1, 3),
  ]);
  assert.equal(r.derivedStart, 4);
  assert.equal(r.derivedEnd, 0);
});

test("(e) 3 coplanar non-collinear points: the polyline's plane is used for both ends", () => {
  // Newell plane of an L on the slab: z = 0.
  const plane = computeNewellPlane([P(1, 1, 0), P(3, 1, 0), P(3, 3, 0)]);
  near(Math.abs(plane.normal.z), 1);
  nearPoint(plane.point, P(1, 1, 0));
  assert.equal(
    computeNewellPlane([P(0, 0, 0), P(1, 0, 0), P(2.5, 0, 0.0005)]),
    null
  );

  // Per-end planes would be y = 1 (start) and x = 3 (end) and would extend
  // the L on the slab; the polyline plane z = 0 is coplanar with the slab and
  // meets no face parallel to the end segments → nothing is added.
  const r = extendCutLine({
    drawn: [P(1, 1, 0), P(3, 1, 0), P(3, 3, 0)],
    startFace: UP,
    endFace: UP,
    triangles: SCENE,
  });
  assert.equal(r.derivedStart, 0);
  assert.equal(r.derivedEnd, 0);
  assert.equal(r.points.length, 3);

  // Same first segment alone (2 points): per-end plane y = 1, extended.
  const two = extendCutLine({
    drawn: [P(1, 1, 0), P(3, 1, 0)],
    startFace: UP,
    endFace: UP,
    triangles: SCENE,
  });
  nearPoints(two.points, [P(0, 1, 0), P(1, 1, 0), P(3, 1, 0), P(10, 1, 0)]);

  // Positive case: slab → wall base → up the wall front, in the x = 2 plane
  // shared by the two ends (end face = wall front, -y).
  const l = extendCutLine({
    drawn: [P(2, 2, 0), P(2, 5, 0), P(2, 5, 1.5)],
    startFace: UP,
    endFace: FRONT,
    triangles: SCENE,
  });
  nearPoints(l.points, [
    P(2, 0, 0),
    P(2, 2, 0),
    P(2, 5, 0),
    P(2, 5, 1.5),
    P(2, 5, 3),
    P(2, 5.2, 3),
    P(2, 5.2, 0),
    P(2, 10, 0),
  ]);
  assert.equal(l.derivedStart, 1);
  assert.equal(l.derivedEnd, 4);
});

test("(f) 8-triangle slab: no intermediate vertex in the extensions", () => {
  const r = extendCutLine({
    drawn: [P(2, 1, 0), P(2, 3, 0)],
    startFace: UP,
    endFace: UP,
    triangles: [...slab({ grid: 2 }), ...wall()],
  });
  nearPoints(r.points, [
    P(2, 0, 0),
    P(2, 1, 0),
    P(2, 3, 0),
    P(2, 5, 0),
    P(2, 5, 3),
    P(2, 5.2, 3),
    P(2, 5.2, 0),
    P(2, 10, 0),
  ]);
});

test("no face under an end → that end is not extended", () => {
  const drawn = [P(2, 1, 0), P(2, 3, 0)];
  const r = extendCutLine({
    drawn,
    startFace: null,
    endFace: UP,
    triangles: SCENE,
  });
  assert.equal(r.derivedStart, 0);
  assert.equal(r.derivedEnd, 5);
  nearPoint(r.points[0], P(2, 1, 0));

  const none = extendCutLine({ drawn, triangles: SCENE });
  assert.deepEqual(none, { points: drawn, derivedStart: 0, derivedEnd: 0 });
});

test("fewer than 2 points or no triangles: returned unchanged", () => {
  const one = [P(2, 1, 0)];
  assert.deepEqual(extendCutLine({ drawn: one, startFace: UP, endFace: UP }), {
    points: one,
    derivedStart: 0,
    derivedEnd: 0,
  });
  const r = extendCutLine({
    drawn: [P(2, 1, 0), P(2, 3, 0)],
    startFace: UP,
    endFace: UP,
    triangles: [],
  });
  assert.equal(r.points.length, 2);
});

test("describeCutLineEnd: per-end plane = segment direction × face normal, through the end point", () => {
  const end = describeCutLineEnd({
    drawn: [P(2, 1, 0), P(2, 3, 0)],
    atEnd: true,
    face: UP,
    polylinePlane: null,
  });
  nearPoint(end.direction, P(0, 1, 0));
  near(Math.abs(end.plane.normal.x), 1);
  near(end.plane.constant, 2 * end.plane.normal.x);
  const start = describeCutLineEnd({
    drawn: [P(2, 1, 0), P(2, 3, 0)],
    atEnd: false,
    face: UP,
    polylinePlane: null,
  });
  nearPoint(start.direction, P(0, -1, 0));
  // Face normal along the segment: no plane.
  assert.equal(
    describeCutLineEnd({
      drawn: [P(2, 1, 0), P(2, 3, 0)],
      atEnd: true,
      face: { normal: P(0, 1, 0) },
      polylinePlane: null,
    }),
    null
  );
});
