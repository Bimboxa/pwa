import assert from "node:assert/strict";
import { test } from "node:test";

import extendCutLine, {
  computeNewellPlane,
  describeCutLineEnd,
} from "./extendCutLine.js";
import {
  P,
  box,
  curvedSheet,
  near,
  nearPoint,
  nearPoints,
  sheet,
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

// A sheet (open sweep) met edge-on: the line is drawn on the plan (not in
// the soup) up to the sheet's foot, the face under the end vertex being the
// sheet itself — its normal runs along the segment.
const SHEET_FACE = { normal: P(0, -1, 0) };

test("sheet met edge-on: the end climbs it in the vertical plane of the segment and stops at the free top edge", () => {
  const r = extendCutLine({
    drawn: [P(2, 1, 0), P(2, 5, 0)],
    endFace: SHEET_FACE,
    triangles: sheet(),
    upNormal: P(0, 0, 1),
  });
  nearPoints(r.points, [P(2, 1, 0), P(2, 5, 0), P(2, 5, 3)]);
  assert.equal(r.derivedStart, 0);
  assert.equal(r.derivedEnd, 1);
});

test("sheet met edge-on without the plan normal: no extension (the cutting plane would be the plan itself)", () => {
  const r = extendCutLine({
    drawn: [P(2, 1, 0), P(2, 5, 0)],
    endFace: SHEET_FACE,
    triangles: sheet(),
  });
  assert.equal(r.derivedEnd, 0);
});

test("describeCutLineEnd: the plan normal replaces a face normal along the segment, and only then", () => {
  const drawn = [P(2, 1, 0), P(2, 5, 0)];
  const endOn = describeCutLineEnd({
    drawn,
    atEnd: true,
    face: SHEET_FACE,
    upNormal: P(0, 0, 1),
  });
  assert.equal(endOn.endOn, true);
  nearPoint(endOn.faceNormal, P(0, 0, 1));
  nearPoint(endOn.plane.normal, P(1, 0, 0), 1e-9);
  const onFace = describeCutLineEnd({
    drawn,
    atEnd: true,
    face: UP,
    upNormal: P(0, 0, 1),
  });
  assert.equal(onFace.endOn, false);
  nearPoint(onFace.faceNormal, P(0, 0, 1));
});

test("sheet standing on a slab: the trace runs along the slab, climbs the sheet and stops at its top", () => {
  const r = extendCutLine({
    drawn: [P(2, 1, 0), P(2, 3, 0)],
    endFace: UP,
    triangles: [...slab(), ...sheet()],
    upNormal: P(0, 0, 1),
  });
  nearPoints(r.points, [P(2, 1, 0), P(2, 3, 0), P(2, 5, 0), P(2, 5, 3)]);
  assert.equal(r.derivedEnd, 2);
});

test("curved sheet (> 64 raw section nodes): the end reaches the top, at most 64 simplified points", () => {
  const r = extendCutLine({
    drawn: [P(2, 1, 0), P(2, 5, 0)],
    endFace: SHEET_FACE,
    triangles: curvedSheet(),
    upNormal: P(0, 0, 1),
  });
  assert.ok(
    r.derivedEnd > 10 && r.derivedEnd <= 64,
    `derived: ${r.derivedEnd}`
  );
  const top = r.points[r.points.length - 1];
  nearPoint(top, P(2, 11, 6));
});

test("gap bridging: a slab edge stopping 1.5 cm short of a sheet's foot still climbs the sheet (2 cm tolerance)", () => {
  const r = extendCutLine({
    drawn: [P(2, 1, 0), P(2, 3, 0)],
    endFace: UP,
    triangles: [...slab({ size: 4.985 }), ...sheet()],
    upNormal: P(0, 0, 1),
  });
  // The slab's free edge (2, 4.985, 0) is collinear with the bridged step
  // and dropped by the simplification: sheet foot, sheet top.
  nearPoints(r.points.slice(2), [P(2, 5, 0), P(2, 5, 3)]);
  assert.equal(r.derivedEnd, 2);
});

test("gap bridging: a 3 cm gap is not bridged", () => {
  const r = extendCutLine({
    drawn: [P(2, 1, 0), P(2, 3, 0)],
    endFace: UP,
    triangles: [...slab({ size: 4.97 }), ...sheet()],
    upNormal: P(0, 0, 1),
  });
  nearPoints(r.points.slice(2), [P(2, 4.97, 0)]);
});

test("gap bridging: a thin plate's bottom corner under the end is no jump target — the trace climbs the sheet 1.5 cm away instead of coming back under the plate", () => {
  // 1 mm plate, top at z = 0, edge at y = 4.985; open sheet at y = 5.
  const plate = box({ min: P(0, 0, -0.001), max: P(10, 4.985, 0) });
  const r = extendCutLine({
    drawn: [P(2, 1, 0), P(2, 4.985, 0)],
    endFace: UP,
    triangles: [...plate, ...sheet()],
    upNormal: P(0, 0, 1),
  });
  nearPoints(r.points.slice(2), [P(2, 5, 0), P(2, 5, 3)]);
  assert.ok(r.points.every((p) => p.z >= 0));
});

test("over a solid standing past the slab edge: down its back, never back under it", () => {
  // Slab [0,5]², a 1 m box 1 cm past its edge (y from 5.01 to 5.2): the gap
  // is bridged, the trace goes over the box, down its back and stops at the
  // foot — its underside (convex, going back) is never walked.
  const solid = box({ min: P(0, 5.01, 0), max: P(10, 5.2, 1) });
  const r = extendCutLine({
    drawn: [P(2, 1, 0), P(2, 3, 0)],
    endFace: UP,
    triangles: [...slab({ size: 5 }), ...solid],
    upNormal: P(0, 0, 1),
  });
  nearPoints(r.points.slice(2), [
    P(2, 5.01, 0),
    P(2, 5.01, 1),
    P(2, 5.2, 1),
    P(2, 5.2, 0),
  ]);
});

// User case 2026-11-12: a cut line drawn down a wall sheet (Z axis tool) to
// its foot, a slab leaving that foot on the viewer's side only. The only way
// on is perpendicular to the drawn direction.
test("line drawn down a sheet to its foot: the start turns onto the slab leaving the foot", () => {
  const r = extendCutLine({
    drawn: [P(2, 5, 0), P(2, 5, 3)],
    startFace: SHEET_FACE,
    endFace: SHEET_FACE,
    triangles: [...slab({ size: 5 }), ...sheet()],
    upNormal: P(0, 0, 1),
  });
  nearPoints(r.points, [P(2, 0, 0), P(2, 5, 0), P(2, 5, 3)]);
  assert.equal(r.derivedStart, 1);
  assert.equal(r.derivedEnd, 0);
});

test("line drawn down a sheet to its foot: a slab 1 mm above the foot and a line 2 mm off the sheet still extend", () => {
  const r = extendCutLine({
    drawn: [P(2, 4.998, 0), P(2, 4.998, 3)],
    startFace: SHEET_FACE,
    endFace: SHEET_FACE,
    triangles: [...slab({ size: 5, z: 0.001 }), ...sheet()],
    upNormal: P(0, 0, 1),
  });
  // Slab edge above the foot (the 1 mm step), then the slab's far edge.
  nearPoints(r.points, [
    P(2, 0, 0.001),
    P(2, 5, 0.001),
    P(2, 4.998, 0),
    P(2, 4.998, 3),
  ]);
  assert.equal(r.derivedStart, 2);
});

test("line drawn down a sheet standing in the middle of a slab: the start takes the viewer's side (re-entrant turn)", () => {
  const r = extendCutLine({
    drawn: [P(2, 5, 0), P(2, 5, 3)],
    startFace: SHEET_FACE,
    endFace: SHEET_FACE,
    triangles: [...slab(), ...sheet()],
    upNormal: P(0, 0, 1),
  });
  nearPoints(r.points, [P(2, 0, 0), P(2, 5, 0), P(2, 5, 3)]);
});
