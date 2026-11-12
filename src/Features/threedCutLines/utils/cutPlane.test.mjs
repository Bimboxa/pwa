import assert from "node:assert/strict";
import { test } from "node:test";

import clipFaceByCutLines from "./clipFaceByCutLines.js";
import computeCutPlaneLines from "./computeCutPlaneLines.js";
import {
  appendToCutPlaneBuffer,
  buildCutPlaneBuffer,
  formatCutPlaneCount,
  parseCutPlaneBuffer,
} from "./cutPlaneBuffer.js";
import extendCutLine from "./extendCutLine.js";
import getCutPlaneStations from "./getCutPlaneStations.js";
import { P, box, near, nearPoint, slab, wall } from "./cutLineFixtures.mjs";

const type = (keys) =>
  [...keys].reduce((buffer, key) => appendToCutPlaneBuffer(buffer, key), "");

test("buffer grammar: length, *N, /N, restart of the count, cap", () => {
  assert.equal(type("1,5"), "1.5");
  assert.equal(type(".5"), "0.5");
  assert.equal(type("1.5*4"), "1.5*4");
  assert.equal(type("6/4"), "6/4");
  assert.equal(type("*3/2"), "/2");
  assert.equal(type("*100"), "*10");
  assert.deepEqual(parseCutPlaneBuffer(""), {
    lengthM: null,
    count: 1,
    mode: "REPEAT",
  });
  assert.deepEqual(parseCutPlaneBuffer("1.5*4"), {
    lengthM: 1.5,
    count: 4,
    mode: "REPEAT",
  });
  assert.deepEqual(parseCutPlaneBuffer("/3"), {
    lengthM: null,
    count: 3,
    mode: "DIVIDE",
  });
  assert.equal(parseCutPlaneBuffer("*").count, 1);
  assert.equal(formatCutPlaneCount("2/3"), "÷3");
  assert.equal(formatCutPlaneCount("2*3"), "×3");
  assert.equal(formatCutPlaneCount("2"), "");
  assert.equal(
    buildCutPlaneBuffer({ valueText: "2", countText: "3", mode: "DIVIDE" }),
    "2/3"
  );
  assert.equal(
    buildCutPlaneBuffer({ valueText: "2", countText: "", mode: "DIVIDE" }),
    "2/"
  );
  assert.equal(
    buildCutPlaneBuffer({ valueText: "2", countText: "", mode: "REPEAT" }),
    "2"
  );
});

test("stations: REPEAT goes beyond P2, DIVIDE splits P1 → P2 (P1 excluded)", () => {
  const p1 = P(0, 0, 0);
  const p2 = P(3, 0, 0);
  const repeat = getCutPlaneStations({ p1, p2, count: 3, mode: "REPEAT" });
  assert.deepEqual(
    repeat.map((s) => s.point.x),
    [3, 6, 9]
  );
  nearPoint(repeat[0].normal, P(1, 0, 0));
  const divide = getCutPlaneStations({ p1, p2, count: 3, mode: "DIVIDE" });
  near(divide[0].point.x, 1);
  near(divide[1].point.x, 2);
  near(divide[2].point.x, 3);
  assert.equal(getCutPlaneStations({ p1, p2: p1, count: 2 }).length, 0);
});

test("closed box: one closed 4-corner loop per plane", () => {
  const triangles = box({ min: P(0, 0, 0), max: P(10, 2, 3) });
  const stations = getCutPlaneStations({
    p1: P(0, 1, 1),
    p2: P(2, 1, 1),
    count: 3,
  });
  const lines = computeCutPlaneLines({ stations, triangles });
  assert.equal(lines.length, 3);
  lines.forEach((line, i) => {
    assert.equal(line.closed, true);
    assert.equal(line.stationIndex, i);
    // 4 corners + the repeated closing point.
    assert.equal(line.points.length, 5);
    nearPoint(line.points[4], line.points[0]);
    for (const p of line.points) near(p.x, 2 * (i + 1));
  });
});

test("open slab: one open 2-point line across it", () => {
  const stations = getCutPlaneStations({ p1: P(0, 5, 0), p2: P(2, 5, 0) });
  const lines = computeCutPlaneLines({ stations, triangles: slab() });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].closed, false);
  assert.equal(lines[0].points.length, 2);
  const ys = lines[0].points.map((p) => p.y).sort((a, b) => a - b);
  near(ys[0], 0);
  near(ys[1], 10);
});

test("nearestOnly keeps the contour closest to the axis point", () => {
  const near1 = box({ min: P(0, 0, 0), max: P(10, 2, 3) });
  const far = box({ min: P(0, 20, 0), max: P(10, 22, 3) });
  const triangles = [...near1, ...far];
  const stations = getCutPlaneStations({ p1: P(0, 1, 1), p2: P(2, 1, 1) });
  assert.equal(computeCutPlaneLines({ stations, triangles }).length, 2);
  const kept = computeCutPlaneLines({ stations, triangles, nearestOnly: true });
  assert.equal(kept.length, 1);
  for (const p of kept[0].points) assert.ok(p.y <= 2 + 1e-9);
});

test("wall standing on a slab: the section is cut at the junctions", () => {
  const triangles = [...slab(), ...wall()];
  const stations = getCutPlaneStations({ p1: P(0, 1, 0), p2: P(2, 1, 0) });
  const lines = computeCutPlaneLines({ stations, triangles });
  assert.ok(lines.length >= 3, `got ${lines.length} lines`);
  for (const line of lines) {
    assert.equal(line.closed, false);
    for (const p of line.points) near(p.x, 2);
  }
});

test("a closed line is never extended and cuts the faces it runs on", () => {
  const triangles = box({ min: P(0, 0, 0), max: P(10, 2, 3) });
  const stations = getCutPlaneStations({ p1: P(0, 1, 1), p2: P(2, 1, 1) });
  const [loop] = computeCutPlaneLines({ stations, triangles });
  assert.equal(loop.closed, true);

  const extended = extendCutLine({
    drawn: loop.points,
    startFace: { normal: P(0, 0, 1) },
    endFace: { normal: P(0, 0, 1) },
    triangles,
  });
  assert.equal(extended.derivedStart, 0);
  assert.equal(extended.derivedEnd, 0);
  assert.equal(extended.points.length, loop.points.length);

  // Top face of the box: the loop crosses it from edge to edge at x = 2.
  const result = clipFaceByCutLines({
    face: {
      contour: [P(0, 0, 3), P(10, 0, 3), P(10, 2, 3), P(0, 2, 3)],
      holes: [],
      normal: P(0, 0, 1),
    },
    cutLines: [loop.points],
  });
  assert.ok(result, "the top face is cut");
  const areas = result.pieces.map((p) => p.area).sort((a, b) => a - b);
  assert.equal(areas.length, 2);
  near(areas[0], 4);
  near(areas[1], 16);
});
