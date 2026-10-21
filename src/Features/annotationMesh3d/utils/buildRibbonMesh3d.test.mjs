import assert from "node:assert/strict";
import { test } from "node:test";

import buildRibbonMesh3d from "./buildRibbonMesh3d.js";
import { buildEdgeMap, getFaceNormal } from "./mesh3dTopology.js";

const v = (x, y, z) => ({ x, y, z });
const near = (a, b, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);

test("open polyline: one quad per segment, consistent shared edges", () => {
  const mesh = buildRibbonMesh3d({
    points: [v(0, 0, 0), v(1, 0, 0), v(1, 1, 0)],
    direction: v(0, 0, 1),
    distance: 2,
  });
  assert.equal(mesh.vertices.length, 6);
  assert.equal(mesh.faces.length, 2);
  near(mesh.vertices[3].z, 2);
  // The shared edge (1 ↔ 4) is run in opposite directions by the two quads.
  const edges = buildEdgeMap(mesh);
  assert.ok(edges.has("1_4") || edges.has("4_1"));
  assert.ok(edges.has("1_4") && edges.has("4_1"));
});

test("closing duplicate and welded points are dropped", () => {
  const mesh = buildRibbonMesh3d({
    points: [v(0, 0, 0), v(1, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 0, 0)],
    direction: v(0, 0, 1),
    distance: 1,
    closeLine: true,
  });
  assert.equal(mesh.vertices.length, 6);
  assert.equal(mesh.faces.length, 3);
});

test("closed ring swept along its area vector faces outward", () => {
  const square = [v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0)]; // CCW, +z
  const up = buildRibbonMesh3d({
    points: square,
    direction: v(0, 0, 1),
    distance: 1,
    closeLine: true,
  });
  // First quad is the y = 0 side: outward is −y.
  near(getFaceNormal(up.vertices, up.faces[0]).y, -1);
  const down = buildRibbonMesh3d({
    points: square,
    direction: v(0, 0, 1),
    distance: -1,
    closeLine: true,
  });
  near(getFaceNormal(down.vertices, down.faces[0]).y, -1);
});

test("open polyline faces the normal hint", () => {
  const args = {
    points: [v(0, 0, 0), v(1, 0, 0)],
    direction: v(0, 0, 1),
    distance: 1,
  };
  const toward = buildRibbonMesh3d({ ...args, normalHint: v(0, 1, 0) });
  near(getFaceNormal(toward.vertices, toward.faces[0]).y, 1);
  const away = buildRibbonMesh3d({ ...args, normalHint: v(0, -1, 0) });
  near(getFaceNormal(away.vertices, away.faces[0]).y, -1);
});

test("degenerate inputs return null", () => {
  assert.equal(
    buildRibbonMesh3d({
      points: [v(0, 0, 0)],
      direction: v(0, 0, 1),
      distance: 1,
    }),
    null
  );
  assert.equal(
    buildRibbonMesh3d({
      points: [v(0, 0, 0), v(1, 0, 0)],
      direction: v(0, 0, 1),
      distance: 0.001,
    }),
    null
  );
  assert.equal(
    buildRibbonMesh3d({
      points: [v(0, 0, 0), v(1, 0, 0)],
      direction: v(0, 0, 0),
      distance: 1,
    }),
    null
  );
});
