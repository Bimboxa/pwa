import assert from "node:assert/strict";
import { test } from "node:test";

import {
  localGeometryToPaint,
  localToPaintPoint,
  paintGeometryToLocal,
  paintPointToLocal,
} from "./meshPaintFrame.js";
import { faceArea, loopAreaVector } from "./meshPaintGeometry.js";
import {
  METRICS,
  near,
  nearV,
  storedFace,
  v,
} from "./meshPaintTestFixtures.mjs";

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

test("frame: corners and center of a non-square image", () => {
  nearV(paintPointToLocal([0.5, 0.5, 1.25], METRICS), v(0, 0, 1.25));
  // Normalized (0, 0) = top-left pixel: local x = -10 m, y = +5 m (y up).
  nearV(paintPointToLocal([0, 0, 0], METRICS), v(-10, 5, 0));
  nearV(paintPointToLocal([1, 1, -2], METRICS), v(10, -5, -2));
  // z is absolute local meters, untouched.
  assert.deepEqual(localToPaintPoint(v(0, 0, 3.5), METRICS), [0.5, 0.5, 3.5]);
});

test("frame: round trip on a non-square image", () => {
  for (const p of [v(3.2, -1.7, 2.5), v(-9.99, 4.99, 0), v(0.001, 0, -1)]) {
    nearV(paintPointToLocal(localToPaintPoint(p, METRICS), METRICS), p, 1e-12);
  }
});

test("frame: FACE normal from the loops, sign from the stored normal", () => {
  // Wall front (plane y = 1) painted on its -y side, loops stored CW about
  // -y (wrong winding): the local face is re-wound about -y.
  const corners = [v(0, 1, 0), v(0, 1, 2), v(4, 1, 2), v(4, 1, 0)];
  const geometry = storedFace(corners, v(0, -1, 0));
  const local = paintGeometryToLocal("FACE", geometry, METRICS);
  nearV(local.normal, v(0, -1, 0), 1e-12);
  assert.ok(dot(loopAreaVector(local.polygons[0].contour), local.normal) > 0);
  near(faceArea(local), 8, 1e-9);

  // Stored normal only gives the side: a stale direction (recalibration) is
  // replaced by the loops' true plane.
  const tilted = storedFace(
    [v(0, 0, 0), v(2, 0, 0), v(2, 1, 1), v(0, 1, 1)],
    v(0, 0, 1)
  );
  const tiltedLocal = paintGeometryToLocal("FACE", tilted, METRICS);
  nearV(tiltedLocal.normal, v(0, -Math.SQRT1_2, Math.SQRT1_2), 1e-9);
});

test("frame: FACE with hole, local → stored → local keeps area, side, winding", () => {
  const local = {
    polygons: [
      {
        // contour given CW about +z, hole CCW: both wrong on purpose
        contour: [v(0, 0, 3), v(0, 3, 3), v(4, 3, 3), v(4, 0, 3)],
        holes: [[v(1, 1, 3), v(2, 1, 3), v(2, 2, 3), v(1, 2, 3)]],
      },
    ],
    normal: v(0, 0, 2), // not unit
  };
  const stored = localGeometryToPaint("FACE", local, METRICS);
  assert.deepEqual(stored.normal, [0, 0, 1]);
  const back = paintGeometryToLocal("FACE", stored, METRICS);
  nearV(back.normal, v(0, 0, 1), 1e-12);
  near(faceArea(back), 11, 1e-9);
  const [polygon] = back.polygons;
  assert.ok(dot(loopAreaVector(polygon.contour), back.normal) > 0);
  assert.ok(dot(loopAreaVector(polygon.holes[0]), back.normal) < 0);
});

test("frame: EDGE round trip and invalid input", () => {
  const edge = { points: [v(-3, 2, 0.5), v(4, -1, 0.5)] };
  const stored = localGeometryToPaint("EDGE", edge, METRICS);
  assert.equal(stored.points.length, 2);
  const back = paintGeometryToLocal("EDGE", stored, METRICS);
  nearV(back.points[0], edge.points[0], 1e-12);
  nearV(back.points[1], edge.points[1], 1e-12);
  assert.equal(
    paintGeometryToLocal("EDGE", { points: [[0, 0, 0]] }, METRICS),
    null
  );
  assert.equal(paintGeometryToLocal("FACE", { polygons: [] }, METRICS), null);
  assert.equal(paintGeometryToLocal("FACE", stored, null), null);
});
