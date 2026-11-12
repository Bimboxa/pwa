import assert from "node:assert/strict";
import { test } from "node:test";

import clipFaceByCutLines from "./clipFaceByCutLines.js";
import computeCutAngleLines from "./computeCutAngleLines.js";
import getCutAngleStations, {
  computeCutAngleDeg,
  resolveCutAngleDeg,
} from "./getCutAngleStations.js";
import { P, box, near, nearPoint, slab } from "./cutLineFixtures.mjs";

const AXIS = P(0, 0, 1);
const ORIGIN = P(5, 5, 0);
const REF = P(8, 5, 0);

test("stations: REPEAT turns by i × angle, DIVIDE splits it, 0° excluded", () => {
  const repeat = getCutAngleStations({
    origin: ORIGIN,
    axis: AXIS,
    refPoint: REF,
    angleDeg: 90,
    count: 3,
  });
  assert.equal(repeat.length, 3);
  nearPoint(repeat[0].dir, P(0, 1, 0));
  nearPoint(repeat[1].dir, P(-1, 0, 0));
  nearPoint(repeat[2].dir, P(0, -1, 0));
  near(repeat[0].radius, 3);
  for (const s of repeat) nearPoint(s.point, ORIGIN);

  const divide = getCutAngleStations({
    origin: ORIGIN,
    axis: AXIS,
    refPoint: REF,
    angleDeg: 90,
    count: 3,
    mode: "DIVIDE",
  });
  assert.deepEqual(
    divide.map((s) => Math.round(s.angleDeg)),
    [30, 60, 90]
  );
  nearPoint(divide[2].dir, P(0, 1, 0));

  // 360 / 4: four rays, the last one back on the reference.
  const full = getCutAngleStations({
    origin: ORIGIN,
    axis: AXIS,
    refPoint: REF,
    angleDeg: 360,
    count: 4,
    mode: "DIVIDE",
  });
  assert.equal(full.length, 4);
  nearPoint(full[3].dir, P(1, 0, 0));
});

test("stations: the reference is made perpendicular to the axis", () => {
  const [station] = getCutAngleStations({
    origin: ORIGIN,
    axis: AXIS,
    refPoint: P(8, 5, 7),
    angleDeg: 90,
  });
  nearPoint(station.dir, P(0, 1, 0));
  nearPoint(station.normal, P(-1, 0, 0));
  const none = { origin: ORIGIN, axis: AXIS, angleDeg: 90 };
  assert.equal(
    getCutAngleStations({ ...none, refPoint: P(5, 5, 4) }).length,
    0
  );
  assert.equal(
    getCutAngleStations({ ...none, refPoint: REF, angleDeg: 0 }).length,
    0
  );
});

test("angle: signed around the axis, a typed value keeps the cursor's side", () => {
  const args = { origin: ORIGIN, axis: AXIS, refPoint: REF };
  near(computeCutAngleDeg({ ...args, cursor: P(5, 8, 2) }), 90);
  near(computeCutAngleDeg({ ...args, cursor: P(5, 2, 0) }), -90);
  assert.equal(computeCutAngleDeg({ ...args, cursor: P(5, 5, 3) }), null);
  near(resolveCutAngleDeg({ ...args, cursor: P(5, 8, 0), typedDeg: 30 }), 30);
  near(resolveCutAngleDeg({ ...args, cursor: P(5, 2, 0), typedDeg: 30 }), -30);
  near(resolveCutAngleDeg({ ...args, cursor: P(5, 5, 0), typedDeg: 30 }), 30);
});

test("slab: a half-plane gives one ray starting on the axis", () => {
  const stations = getCutAngleStations({
    origin: ORIGIN,
    axis: AXIS,
    refPoint: REF,
    angleDeg: 90,
  });
  const lines = computeCutAngleLines({ stations, triangles: slab() });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].closed, false);
  assert.equal(lines[0].points.length, 2);
  const ys = lines[0].points.map((p) => p.y).sort((a, b) => a - b);
  near(ys[0], 5);
  near(ys[1], 10);
  for (const p of lines[0].points) near(p.x, 5);
});

test("slab, 360/4: four separate rays sharing the pivot", () => {
  const stations = getCutAngleStations({
    origin: ORIGIN,
    axis: AXIS,
    refPoint: REF,
    angleDeg: 360,
    count: 4,
    mode: "DIVIDE",
  });
  const lines = computeCutAngleLines({
    stations,
    triangles: slab({ grid: 2 }),
  });
  assert.equal(lines.length, 4);
  assert.deepEqual(
    lines.map((l) => l.stationIndex),
    [0, 1, 2, 3]
  );
  for (const line of lines) {
    // Oriented to end on the pivot, flagged for the « Stop ».
    assert.equal(line.stopAtEnd, true);
    nearPoint(line.points[line.points.length - 1], ORIGIN);
    assert.ok(Math.hypot(line.points[0].x - 5, line.points[0].y - 5) > 1);
  }

  // The rays meet inside the slab: together they cut it in four.
  const clip = clipFaceByCutLines({
    face: {
      contour: [P(0, 0, 0), P(10, 0, 0), P(10, 10, 0), P(0, 10, 0)],
      holes: [],
      normal: P(0, 0, 1),
    },
    cutLines: lines.map((line) => line.points),
  });
  assert.ok(clip, "the slab is cut");
  assert.equal(clip.pieces.length, 4);
  for (const piece of clip.pieces) near(piece.area, 25);
});

test("a single ray ending inside a face cuts nothing", () => {
  const stations = getCutAngleStations({
    origin: ORIGIN,
    axis: AXIS,
    refPoint: REF,
    angleDeg: 90,
  });
  const lines = computeCutAngleLines({ stations, triangles: slab() });
  const clip = clipFaceByCutLines({
    face: {
      contour: [P(0, 0, 0), P(10, 0, 0), P(10, 10, 0), P(0, 10, 0)],
      holes: [],
      normal: P(0, 0, 1),
    },
    cutLines: lines.map((line) => line.points),
  });
  assert.equal(clip, null);
});

test("closed box: the loop is opened on the axis side", () => {
  const triangles = box({ min: P(0, 0, 0), max: P(10, 2, 3) });
  const stations = getCutAngleStations({
    origin: P(5, 1, 1),
    axis: AXIS,
    refPoint: P(8, 1, 1),
    angleDeg: 90,
  });
  const lines = computeCutAngleLines({ stations, triangles });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].closed, false);
  assert.equal(lines[0].points.length, 4);
  for (const p of lines[0].points) {
    near(p.x, 5);
    assert.ok(p.y >= 1 - 1e-9);
  }
});

test("nearestOnly keeps the contour closest to the pivot", () => {
  const triangles = [...slab(), ...slab({ z: 5 })];
  const stations = getCutAngleStations({
    origin: ORIGIN,
    axis: AXIS,
    refPoint: REF,
    angleDeg: 90,
  });
  assert.equal(computeCutAngleLines({ stations, triangles }).length, 2);
  const kept = computeCutAngleLines({ stations, triangles, nearestOnly: true });
  assert.equal(kept.length, 1);
  for (const p of kept[0].points) near(p.z, 0);
});
